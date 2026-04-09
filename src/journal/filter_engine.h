// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.
//
// FilterEngine — lightweight request classifier for the Request Journal.
//
// Classifies each URL as one of the ResourceClass values defined in
// request_journal.h.  Uses two mechanisms:
//
//   1. Hard-coded telemetry / fingerprint patterns — fast, zero-dependency
//      detection of known Google, Microsoft, and common CDN telemetry.
//
//   2. uBlock Origin filter list rules — a minimal subset of the Adblock Plus
//      filter syntax that covers the vast majority of EasyList / EasyPrivacy
//      network rules (||domain^, ||domain/path^, @@whitelist).
//      Full cosmetic / scriptlet rules are ignored (handled by the uBO
//      extension itself).
//
// Thread-safety: FilterEngine is immutable after construction and may be
// called from any thread simultaneously.

#ifndef FENNEC_JOURNAL_FILTER_ENGINE_H_
#define FENNEC_JOURNAL_FILTER_ENGINE_H_

#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "fennec/journal/request_journal.h"
#include "url/gurl.h"

namespace fennec {

// A single parsed filter rule from an Adblock Plus / uBO list.
struct FilterRule {
  enum class Type { kBlock, kAllow };

  Type        type;
  std::string pattern;     // The URL pattern (after stripping || and ^)
  bool        domain_anchor;  // true if pattern started with ||
  bool        is_regex;       // true if pattern is /regex/
  std::string domain_opt;     // "$domain=foo.com" restriction (empty = any)
};

// ── FilterListId ─────────────────────────────────────────────────────────
// Identifies which list a rule came from, for the Journal block-reason.
enum class FilterListId : int {
  kEasyList    = 0,
  kEasyPrivacy = 1,
  kUboFilters  = 2,
  kUboPrivacy  = 3,
  kPeterLowe   = 4,
};

const char* FilterListName(FilterListId id);

// ── FilterEngine ─────────────────────────────────────────────────────────

class FilterEngine {
 public:
  FilterEngine();
  ~FilterEngine() = default;

  // Disable copy; the rule vectors are potentially large.
  FilterEngine(const FilterEngine&)            = delete;
  FilterEngine& operator=(const FilterEngine&) = delete;

  // Loads filter rules from the given text (Adblock Plus format).
  // |list_id| is used to annotate the block reason in Journal entries.
  // May be called multiple times to load several lists; rules accumulate.
  void LoadFilterList(std::string_view filter_text, FilterListId list_id);

  // Classifies |request_url| in the context of |top_frame_url|.
  // Returns the ResourceClass and, if blocked/classified, sets |out_reason|
  // to a short human-readable description (e.g. "EasyList §general-block").
  ResourceClass Classify(const GURL& request_url,
                         const GURL& top_frame_url,
                         std::string* out_reason) const;

  // Returns the number of loaded rules across all lists.
  size_t RuleCount() const;

 private:
  // ── Hard-coded telemetry patterns ───────────────────────────────────────
  // Returns kTelemetry if the URL matches a known telemetry endpoint.
  bool MatchesTelemetryPattern(const std::string& host) const;

  // Returns kFingerprintProbe if the URL path / params match fingerprint
  // collection heuristics.
  bool MatchesFingerprintPattern(const GURL& url) const;

  // ── Rule matching ────────────────────────────────────────────────────────
  // Returns true if |rule| matches |url| in the context of |top_frame_host|.
  bool RuleMatches(const FilterRule& rule,
                   const GURL& url,
                   std::string_view top_frame_host) const;

  // ── Rule storage ─────────────────────────────────────────────────────────
  struct RuleEntry {
    FilterRule     rule;
    FilterListId   list_id;
  };

  // Domain-bucketed index: host suffix → matching rules.
  // Enables O(1) average-case lookup by hostname.
  std::unordered_map<std::string, std::vector<RuleEntry>> domain_index_;

  // Rules with no domain anchor (slower, checked after domain index miss).
  std::vector<RuleEntry> generic_rules_;
};

}  // namespace fennec

#endif  // FENNEC_JOURNAL_FILTER_ENGINE_H_
