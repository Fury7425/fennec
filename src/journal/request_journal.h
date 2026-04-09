// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.
//
// RequestJournal — per-profile SQLite log of every network request.
// Backs the fennec://journal WebUI page (Transparency pillar).
//
// Every request Fennec's engine makes — including its own internal
// requests for filter list refreshes, update checks, and Mods registry
// pings — is logged identically to page requests.  Nothing is hidden.

#ifndef FENNEC_JOURNAL_REQUEST_JOURNAL_H_
#define FENNEC_JOURNAL_REQUEST_JOURNAL_H_

#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/task/sequenced_task_runner.h"
#include "base/time/time.h"
#include "sql/database.h"

namespace fennec {

// ── Classification ─────────────────────────────────────────────────────────
//
// Every request gets exactly one ResourceClass assigned by the
// FilterEngine.  The classification is stored in the database and shown
// in the fennec://journal sidebar panel.

enum class ResourceClass : int {
  kFirstParty       = 0,  // Same eTLD+1 as the top-level document
  kThirdParty       = 1,  // Different origin; no list match
  kTracker          = 2,  // Matched a tracker rule (EasyPrivacy / uBO-privacy)
  kAd               = 3,  // Matched an ad rule (EasyList / uBO-filters)
  kTelemetry        = 4,  // Hard-coded known telemetry endpoint (Google, MS …)
  kFingerprintProbe = 5,  // URL pattern consistent with fingerprint collection
  kFennecInternal   = 6,  // Request originated from Fennec itself
  kBlocked          = 7,  // Blocked before classification could be completed
};

// Human-readable label for each class (used in the WebUI badge).
const char* ResourceClassLabel(ResourceClass cls);

// ── Entry ──────────────────────────────────────────────────────────────────

struct JournalEntry {
  int64_t       id;
  base::Time    timestamp;
  std::string   url;
  std::string   resource_type;   // "fetch" | "script" | "image" | "font" …
  std::string   source_url;      // Top-level document URL at time of request
  std::string   initiator_url;   // Direct initiator (may be same as source)
  std::string   source_tag;      // "page" | "fennec-internal" | "ublock"
  int           status_code;     // HTTP status; 0 if not yet responded / blocked
  std::string   mime_type;
  bool          blocked;
  std::string   block_reason;    // e.g. "uBO: EasyList §…" or "consent-guard"
  ResourceClass resource_class;
  int64_t       response_bytes;  // Content-Length from response; -1 if unknown
};

// ── Observer ───────────────────────────────────────────────────────────────
//
// Subscribe() registers a callback that is invoked on the Journal's
// task runner whenever a new entry is written.  Used by the Mojo handler
// (journal_mojo_handler.cc) to push live updates to the WebUI.

class RequestJournalObserver {
 public:
  virtual ~RequestJournalObserver() = default;
  virtual void OnNewEntry(const JournalEntry& entry) = 0;
};

// ── RequestJournal ─────────────────────────────────────────────────────────
//
// Per-profile singleton.  Owns a sql::Database at
//   <profile_path>/fennec/request_journal.db
//
// All public methods are safe to call from any thread; they post to the
// dedicated SequencedTaskRunner if called off-sequence.

class RequestJournal {
 public:
  explicit RequestJournal(const base::FilePath& profile_path);
  ~RequestJournal();

  RequestJournal(const RequestJournal&)            = delete;
  RequestJournal& operator=(const RequestJournal&) = delete;

  // Opens (or creates) the database and applies the schema migration.
  // Must be called before any other method.  Returns false on failure.
  bool Initialize();

  // ── Write API ────────────────────────────────────────────────────────────

  // Called when a URL request begins.  Returns the assigned row id so
  // OnResponse / OnBlock can correlate the lifecycle events.
  // |source_tag| should be "page" for page-initiated requests or
  // "fennec-internal" for requests Fennec itself originates.
  int64_t RecordRequest(const std::string& url,
                        const std::string& resource_type,
                        const std::string& source_url,
                        const std::string& initiator_url,
                        const std::string& source_tag,
                        ResourceClass resource_class);

  // Called when a response is received.  Updates the matching row.
  void RecordResponse(int64_t entry_id,
                      int status_code,
                      const std::string& mime_type,
                      int64_t response_bytes);

  // Called when a request is blocked (consent guard, uBO, or policy).
  void RecordBlock(int64_t entry_id, const std::string& reason);

  // ── Read API ─────────────────────────────────────────────────────────────

  // Returns up to |limit| entries in descending timestamp order.
  std::vector<JournalEntry> GetRecentEntries(int limit = 500);

  // Returns entries matching |filter_class| (kBlocked → blocked=1).
  std::vector<JournalEntry> GetEntriesByClass(ResourceClass filter_class,
                                              int limit = 500);

  // Exports all entries from the last |days| days as a JSON string.
  // Used by the "Export as JSON" button in fennec://journal.
  std::string ExportAsJson(int days = 7);

  // Deletes all entries older than |days| days.  Called on a daily timer.
  void PruneOlderThan(int days = 7);

  // Deletes all entries from the database.
  void Clear();

  // ── Observer API ─────────────────────────────────────────────────────────

  // Registers |observer| to receive OnNewEntry() callbacks on |task_runner|.
  // Returns an opaque subscription id for Unsubscribe().
  int Subscribe(RequestJournalObserver* observer,
                scoped_refptr<base::SequencedTaskRunner> task_runner);

  // Removes the subscription with the given id.
  void Unsubscribe(int subscription_id);

 private:
  bool CreateSchema();
  void NotifyObservers(const JournalEntry& entry);

  // ── Subscription bookkeeping ────────────────────────────────────────────
  struct Subscription {
    int                                           id;
    RequestJournalObserver*                       observer;
    scoped_refptr<base::SequencedTaskRunner>      task_runner;
  };

  base::FilePath  db_path_;
  sql::Database   db_;
  int             next_subscription_id_ = 1;
  std::vector<Subscription> subscriptions_;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<RequestJournal> weak_factory_{this};
};

}  // namespace fennec

#endif  // FENNEC_JOURNAL_REQUEST_JOURNAL_H_
