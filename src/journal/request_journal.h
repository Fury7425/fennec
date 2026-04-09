// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.
//
// RequestJournal — per-profile SQLite log of every network request.
// Backs the fennec://journal WebUI page (Transparency pillar).

#ifndef FENNEC_JOURNAL_REQUEST_JOURNAL_H_
#define FENNEC_JOURNAL_REQUEST_JOURNAL_H_

#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/time/time.h"
#include "sql/database.h"

namespace fennec {

// Classification of a network request relative to the current page context.
enum class ResourceClass {
  kFirstParty,   // Same origin as the top-level document
  kThirdParty,   // Different origin, not a known tracker
  kTracker,      // Matched against the embedded tracker list
  kBlocked,      // Blocked by ConsentFirstNetworkGuard or Qjz9zkBlocker
};

struct JournalEntry {
  int64_t      id;
  base::Time   timestamp;
  std::string  url;
  std::string  resource_type;  // "xhr", "script", "image", "font", etc.
  std::string  source_url;     // Initiator page URL
  int          status_code;    // 0 if not yet responded
  std::string  mime_type;
  bool         blocked;
  std::string  block_reason;
  ResourceClass resource_class;
};

// Per-profile singleton. Owns a sql::Database at
// <profile_path>/fennec/request_journal.db.
class RequestJournal {
 public:
  explicit RequestJournal(const base::FilePath& profile_path);
  ~RequestJournal();

  RequestJournal(const RequestJournal&) = delete;
  RequestJournal& operator=(const RequestJournal&) = delete;

  // Opens (or creates) the database. Must be called before any other method.
  bool Initialize();

  // Called by JournalInterceptor when a URL request begins.
  void RecordRequest(const std::string& url,
                     const std::string& resource_type,
                     const std::string& source_url);

  // Called when a response is received. Updates the existing row.
  void RecordResponse(const std::string& url,
                      int status_code,
                      const std::string& mime_type);

  // Called when a request is blocked. Marks the row blocked=1.
  void RecordBlock(const std::string& url, const std::string& reason);

  // Returns the most recent |limit| entries, newest first.
  std::vector<JournalEntry> QueryRecent(int limit = 500);

  // Clears all entries from the database.
  void Clear();

 private:
  bool CreateSchema();

  base::FilePath  db_path_;
  sql::Database   db_;
};

}  // namespace fennec

#endif  // FENNEC_JOURNAL_REQUEST_JOURNAL_H_
