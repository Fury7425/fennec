// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.

#include "fennec/journal/filter_engine.h"

#include <algorithm>
#include <sstream>

#include "base/logging.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"
#include "net/base/registry_controlled_domains/registry_controlled_domain.h"
#include "url/gurl.h"

namespace fennec {

// ── Filter list name labels ────────────────────────────────────────────────

const char* FilterListName(FilterListId id) {
  switch (id) {
    case FilterListId::kEasyList:    return "EasyList";
    case FilterListId::kEasyPrivacy: return "EasyPrivacy";
    case FilterListId::kUboFilters:  return "uBO Filters";
    case FilterListId::kUboPrivacy:  return "uBO Privacy";
    case FilterListId::kPeterLowe:   return "Peter Lowe's List";
  }
  return "Unknown";
}

// ── Hard-coded telemetry hostnames / suffixes ─────────────────────────────
//
// These cover the most common telemetry, analytics, and update-check
// endpoints from major vendors.  The list is intentionally conservative:
// only endpoints whose sole purpose is telemetry / metrics / crash
// reporting are included.  General CDN / content hosts are excluded.

static const char* const kTelemetryHostSuffixes[] = {
  // Google telemetry / metrics
  "clients1.google.com",
  "clients2.google.com",
  "clients4.google.com",
  "update.googleapis.com",
  "tools.google.com",
  "ssl.gstatic.com",
  "safebrowsing.googleapis.com",
  "safebrowsing.google.com",
  "crashreporter.google.com",
  "clients.google.com",
  "report.crashlytics.com",
  "app-measurement.com",
  "google-analytics.com",
  "analytics.google.com",
  "stats.g.doubleclick.net",
  "ssl.google-analytics.com",
  "ssl.gstatic.com",

  // Microsoft telemetry
  "vortex.data.microsoft.com",
  "settings-win.data.microsoft.com",
  "watson.microsoft.com",
  "watson.telemetry.microsoft.com",
  "telecommand.telemetry.microsoft.com",
  "oca.telemetry.microsoft.com",
  "sqm.telemetry.microsoft.com",
  "asimov-win.settings.data.microsoft.com",

  // Apple
  "metrics.apple.com",
  "iphone-ips.apple.com",
  "radarsubmissions.apple.com",

  // Mozilla
  "telemetry.mozilla.org",
  "incoming.telemetry.mozilla.org",
  "crash-reports.mozilla.com",

  // Meta (Facebook)
  "graph.facebook.com",
  "an.facebook.com",
  "pixel.facebook.com",

  // Adobe
  "metrics.adobe.com",
  "adobe.omtrdc.net",
  "omtrdc.net",

  // Mixpanel, Amplitude, Segment, etc.
  "api.mixpanel.com",
  "api.amplitude.com",
  "api.segment.io",
  "cdn.segment.com",
  "cdn.segment.io",
  "api.intercom.io",
  "widget.intercom.io",
  "nexus-websocket-a.intercom.io",
  "api.heap.io",
  "heapanalytics.com",
  "sentry.io",
  "ingest.sentry.io",

  // Crashlytics / Firebase
  "firebaselogging-pa.googleapis.com",
  "firebase-settings.crashlytics.com",
  "settings.crashlytics.com",
};

// ── Fingerprint probe path/param heuristics ───────────────────────────────

static const char* const kFingerprintPathFragments[] = {
  "/fingerprint",
  "/fp/",
  "/canvas/",
  "/webgl-fingerprint",
  "/browser-fingerprint",
  "/font-list",
  "/detect-fonts",
  "/clienthints",
  "/__ua",
  "/_/boomerang",
};

static const char* const kFingerprintQueryParams[] = {
  "canvas_hash",
  "fp_hash",
  "webgl_vendor",
  "audio_hash",
  "font_hash",
  "client_hints",
};

// ── FilterEngine ─────────────────────────────────────────────────────────

FilterEngine::FilterEngine() = default;

// ── Filter list parser ────────────────────────────────────────────────────
//
// Implements a minimal subset of the Adblock Plus filter syntax:
//
//   ||domain.com^          — domain-anchored block rule
//   ||domain.com/path^     — domain+path block rule
//   @@||domain.com^        — whitelist rule
//   /regex/                — regex rule (stored as generic)
//   ! comment              — ignored
//   # comment              — ignored
//   [Adblock Plus …]       — header, ignored
//
// Options (after $) are parsed but only $domain= is honoured.
// Cosmetic rules (##, #@#) are skipped — handled by uBO itself.

void FilterEngine::LoadFilterList(std::string_view filter_text,
                                  FilterListId list_id) {
  size_t rules_added = 0;

  std::istringstream stream{std::string(filter_text)};
  std::string line;

  while (std::getline(stream, line)) {
    // Strip CR if present (Windows line endings).
    if (!line.empty() && line.back() == '\r')
      line.pop_back();

    if (line.empty())           continue;
    if (line[0] == '!')         continue;  // Comment
    if (line[0] == '#')         continue;  // Comment
    if (line[0] == '[')         continue;  // Header

    // Skip cosmetic/scriptlet rules — they are not network rules.
    if (line.find("##") != std::string::npos) continue;
    if (line.find("#@#") != std::string::npos) continue;
    if (line.find("#?#") != std::string::npos) continue;
    if (line.find("#$#") != std::string::npos) continue;

    FilterRule rule;
    rule.domain_anchor = false;
    rule.is_regex      = false;
    rule.type          = FilterRule::Type::kBlock;

    std::string pattern = line;

    // Whitelist prefix @@
    if (base::StartsWith(pattern, "@@", base::CompareCase::SENSITIVE)) {
      rule.type = FilterRule::Type::kAllow;
      pattern = pattern.substr(2);
    }

    // Parse options after '$'
    size_t dollar_pos = pattern.rfind('$');
    if (dollar_pos != std::string::npos) {
      std::string opts = pattern.substr(dollar_pos + 1);
      pattern = pattern.substr(0, dollar_pos);

      // Extract $domain= restriction.
      size_t domain_pos = opts.find("domain=");
      if (domain_pos != std::string::npos) {
        size_t end_pos = opts.find(',', domain_pos);
        rule.domain_opt = opts.substr(
            domain_pos + 7,
            end_pos == std::string::npos ? std::string::npos
                                         : end_pos - domain_pos - 7);
      }

      // Skip rules requiring third-party or specific resource type logic
      // that we don't implement here — they are handled by uBO.
      // (We only classify; we don't block in this engine.)
    }

    // Regex rule
    if (pattern.size() >= 2 && pattern.front() == '/' &&
        pattern.back() == '/') {
      rule.is_regex = true;
      rule.pattern  = pattern.substr(1, pattern.size() - 2);
      generic_rules_.push_back({rule, list_id});
      ++rules_added;
      continue;
    }

    // Domain anchor ||
    if (base::StartsWith(pattern, "||", base::CompareCase::SENSITIVE)) {
      rule.domain_anchor = true;
      pattern = pattern.substr(2);
    } else if (base::StartsWith(pattern, "|", base::CompareCase::SENSITIVE)) {
      pattern = pattern.substr(1);
    }

    // Strip trailing separator ^
    if (!pattern.empty() && pattern.back() == '^')
      pattern.pop_back();

    if (pattern.empty()) continue;

    rule.pattern = pattern;

    // If domain-anchored, index by the hostname portion.
    if (rule.domain_anchor) {
      // Extract the host up to the first / or end.
      size_t slash = pattern.find('/');
      std::string host = (slash == std::string::npos)
                             ? pattern
                             : pattern.substr(0, slash);

      // Remove leading www. for broader matching.
      if (base::StartsWith(host, "www.", base::CompareCase::INSENSITIVE_ASCII))
        host = host.substr(4);

      if (!host.empty()) {
        domain_index_[host].push_back({rule, list_id});
        ++rules_added;
        continue;
      }
    }

    generic_rules_.push_back({rule, list_id});
    ++rules_added;
  }

  VLOG(1) << "[FilterEngine] Loaded " << rules_added
          << " rules from " << FilterListName(list_id);
}

// ── Classification ─────────────────────────────────────────────────────────

ResourceClass FilterEngine::Classify(const GURL& request_url,
                                     const GURL& top_frame_url,
                                     std::string* out_reason) const {
  if (!request_url.is_valid()) {
    if (out_reason) *out_reason = "invalid-url";
    return ResourceClass::kBlocked;
  }

  const std::string req_host = request_url.host();

  // ── First-party check ────────────────────────────────────────────────────
  // Uses eTLD+1 comparison so foo.example.com and bar.example.com are
  // both first-party to example.com.
  if (top_frame_url.is_valid() && !top_frame_url.host().empty()) {
    const std::string req_etld1 =
        net::registry_controlled_domains::GetDomainAndRegistry(
            request_url,
            net::registry_controlled_domains::INCLUDE_PRIVATE_REGISTRIES);
    const std::string top_etld1 =
        net::registry_controlled_domains::GetDomainAndRegistry(
            top_frame_url,
            net::registry_controlled_domains::INCLUDE_PRIVATE_REGISTRIES);
    if (!req_etld1.empty() && req_etld1 == top_etld1) {
      if (out_reason) *out_reason = "";
      return ResourceClass::kFirstParty;
    }
  }

  // ── Hard-coded telemetry ─────────────────────────────────────────────────
  if (MatchesTelemetryPattern(req_host)) {
    if (out_reason) *out_reason = "telemetry";
    return ResourceClass::kTelemetry;
  }

  // ── Fingerprint probe heuristic ──────────────────────────────────────────
  if (MatchesFingerprintPattern(request_url)) {
    if (out_reason) *out_reason = "fingerprint-probe";
    return ResourceClass::kFingerprintProbe;
  }

  // ── Rule-based classification ────────────────────────────────────────────
  // Check domain index first (fast path).
  // Walk every suffix of req_host.
  std::string host = req_host;
  if (base::StartsWith(host, "www.", base::CompareCase::INSENSITIVE_ASCII))
    host = host.substr(4);

  auto check_rules = [&](const std::vector<RuleEntry>& entries)
      -> std::pair<bool, FilterListId> {
    for (const auto& re : entries) {
      if (RuleMatches(re.rule, request_url, top_frame_url.host())) {
        if (re.rule.type == FilterRule::Type::kAllow)
          return {false, re.list_id};  // Whitelist hit → not classified
        return {true, re.list_id};
      }
    }
    return {false, FilterListId::kEasyList};  // No match
  };

  // Try exact host and walk up the domain hierarchy.
  {
    std::string suffix = host;
    while (!suffix.empty()) {
      auto it = domain_index_.find(suffix);
      if (it != domain_index_.end()) {
        auto [matched, list_id] = check_rules(it->second);
        if (matched) {
          // Distinguish tracker vs ad by list.
          if (list_id == FilterListId::kEasyPrivacy ||
              list_id == FilterListId::kUboPrivacy) {
            if (out_reason) *out_reason =
                std::string(FilterListName(list_id)) + " §tracker";
            return ResourceClass::kTracker;
          }
          if (out_reason) *out_reason =
              std::string(FilterListName(list_id)) + " §ad";
          return ResourceClass::kAd;
        }
      }
      // Strip one label from the left.
      size_t dot = suffix.find('.');
      if (dot == std::string::npos) break;
      suffix = suffix.substr(dot + 1);
    }
  }

  // Generic rules (slower path).
  {
    auto [matched, list_id] = check_rules(generic_rules_);
    if (matched) {
      if (list_id == FilterListId::kEasyPrivacy ||
          list_id == FilterListId::kUboPrivacy) {
        if (out_reason) *out_reason =
            std::string(FilterListName(list_id)) + " §tracker";
        return ResourceClass::kTracker;
      }
      if (out_reason) *out_reason =
          std::string(FilterListName(list_id)) + " §ad";
      return ResourceClass::kAd;
    }
  }

  if (out_reason) *out_reason = "";
  return ResourceClass::kThirdParty;
}

// ── Rule matching ──────────────────────────────────────────────────────────

bool FilterEngine::RuleMatches(const FilterRule& rule,
                                const GURL& url,
                                std::string_view top_frame_host) const {
  // Domain restriction check.
  if (!rule.domain_opt.empty()) {
    bool domain_match = false;
    // domain_opt may be "foo.com|bar.com" (pipe-separated).
    std::vector<std::string> domains =
        base::SplitString(rule.domain_opt, "|",
                          base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);
    for (const auto& d : domains) {
      if (!d.empty() && d[0] == '~') continue;  // Exclusion — skip
      if (base::EndsWith(std::string(top_frame_host), d,
                         base::CompareCase::INSENSITIVE_ASCII)) {
        domain_match = true;
        break;
      }
    }
    if (!domain_match) return false;
  }

  if (rule.is_regex) {
    // TODO: RE2 integration.  For now, skip regex rules in the engine.
    return false;
  }

  const std::string& pattern = rule.pattern;
  const std::string  spec    = url.spec();

  if (rule.domain_anchor) {
    // The pattern should appear after the scheme+authority portion of the URL.
    return spec.find(pattern) != std::string::npos;
  }

  // Substring match.
  return spec.find(pattern) != std::string::npos;
}

// ── Hard-coded pattern helpers ─────────────────────────────────────────────

bool FilterEngine::MatchesTelemetryPattern(const std::string& host) const {
  for (const char* suffix : kTelemetryHostSuffixes) {
    if (host == suffix) return true;
    // Check if host ends with ".suffix"
    const size_t slen = strlen(suffix);
    if (host.size() > slen &&
        host[host.size() - slen - 1] == '.' &&
        host.compare(host.size() - slen, slen, suffix) == 0) {
      return true;
    }
  }
  return false;
}

bool FilterEngine::MatchesFingerprintPattern(const GURL& url) const {
  const std::string path = url.path();
  for (const char* frag : kFingerprintPathFragments) {
    if (path.find(frag) != std::string::npos) return true;
  }

  const std::string query = url.query();
  for (const char* param : kFingerprintQueryParams) {
    if (query.find(param) != std::string::npos) return true;
  }

  return false;
}

size_t FilterEngine::RuleCount() const {
  size_t count = generic_rules_.size();
  for (const auto& [host, rules] : domain_index_)
    count += rules.size();
  return count;
}

}  // namespace fennec
