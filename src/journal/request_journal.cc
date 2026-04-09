// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.

#include "fennec/journal/request_journal.h"

#include "base/files/file_util.h"
#include "base/logging.h"
#include "sql/statement.h"
#include "sql/transaction.h"

namespace fennec {

namespace {

constexpr char kCreateRequestsTable[] = R"sql(
  CREATE TABLE IF NOT EXISTS requests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp      INTEGER NOT NULL,
    url            TEXT    NOT NULL,
    resource_type  TEXT    NOT NULL DEFAULT '',
    source_url     TEXT    NOT NULL DEFAULT '',
    status_code    INTEGER NOT NULL DEFAULT 0,
    mime_type      TEXT    NOT NULL DEFAULT '',
    blocked        INTEGER NOT NULL DEFAULT 0,
    block_reason   TEXT    NOT NULL DEFAULT '',
    resource_class INTEGER NOT NULL DEFAULT 0
  );
)sql";

constexpr char kCreateUrlIndex[] =
    "CREATE INDEX IF NOT EXISTS idx_url ON requests(url);";

constexpr char kCreateTimestampIndex[] =
    "CREATE INDEX IF NOT EXISTS idx_ts ON requests(timestamp DESC);";

}  // namespace

RequestJournal::RequestJournal(const base::FilePath& profile_path)
    : db_path_(profile_path.AppendASCII("fennec").AppendASCII("request_journal.db")) {}

RequestJournal::~RequestJournal() = default;

bool RequestJournal::Initialize() {
  base::FilePath dir = db_path_.DirName();
  if (!base::CreateDirectory(dir)) {
    LOG(ERROR) << "RequestJournal: could not create directory: " << dir;
    return false;
  }

  if (!db_.Open(db_path_)) {
    LOG(ERROR) << "RequestJournal: could not open database: " << db_path_;
    return false;
  }

  db_.set_error_suppressor_for_testing(base::DoNothing());
  return CreateSchema();
}

bool RequestJournal::CreateSchema() {
  sql::Transaction t(&db_);
  if (!t.Begin()) return false;

  if (!db_.Execute(kCreateRequestsTable)) return false;
  if (!db_.Execute(kCreateUrlIndex))     return false;
  if (!db_.Execute(kCreateTimestampIndex)) return false;

  return t.Commit();
}

void RequestJournal::RecordRequest(const std::string& url,
                                    const std::string& resource_type,
                                    const std::string& source_url) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    INSERT INTO requests (timestamp, url, resource_type, source_url)
    VALUES (?, ?, ?, ?)
  )sql"));

  stmt.BindInt64(0, base::Time::Now().ToInternalValue());
  stmt.BindString(1, url);
  stmt.BindString(2, resource_type);
  stmt.BindString(3, source_url);
  stmt.Run();
}

void RequestJournal::RecordResponse(const std::string& url,
                                     int status_code,
                                     const std::string& mime_type) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    UPDATE requests SET status_code = ?, mime_type = ?
    WHERE url = ? AND status_code = 0
    ORDER BY id DESC LIMIT 1
  )sql"));

  stmt.BindInt(0, status_code);
  stmt.BindString(1, mime_type);
  stmt.BindString(2, url);
  stmt.Run();
}

void RequestJournal::RecordBlock(const std::string& url,
                                  const std::string& reason) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    UPDATE requests SET blocked = 1, block_reason = ?
    WHERE url = ?
    ORDER BY id DESC LIMIT 1
  )sql"));

  stmt.BindString(0, reason);
  stmt.BindString(1, url);
  stmt.Run();
}

std::vector<JournalEntry> RequestJournal::QueryRecent(int limit) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    SELECT id, timestamp, url, resource_type, source_url,
           status_code, mime_type, blocked, block_reason, resource_class
    FROM requests
    ORDER BY id DESC
    LIMIT ?
  )sql"));

  stmt.BindInt(0, limit);

  std::vector<JournalEntry> entries;
  while (stmt.Step()) {
    JournalEntry e;
    e.id             = stmt.ColumnInt64(0);
    e.timestamp      = base::Time::FromInternalValue(stmt.ColumnInt64(1));
    e.url            = stmt.ColumnString(2);
    e.resource_type  = stmt.ColumnString(3);
    e.source_url     = stmt.ColumnString(4);
    e.status_code    = stmt.ColumnInt(5);
    e.mime_type      = stmt.ColumnString(6);
    e.blocked        = stmt.ColumnBool(7);
    e.block_reason   = stmt.ColumnString(8);
    e.resource_class = static_cast<ResourceClass>(stmt.ColumnInt(9));
    entries.push_back(std::move(e));
  }
  return entries;
}

void RequestJournal::Clear() {
  db_.Execute("DELETE FROM requests;");
}

}  // namespace fennec
