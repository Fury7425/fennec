// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.

#include "fennec/journal/request_journal.h"

#include "base/files/file_util.h"
#include "base/json/json_writer.h"
#include "base/logging.h"
#include "base/strings/stringprintf.h"
#include "base/task/sequenced_task_runner.h"
#include "base/time/time.h"
#include "base/values.h"
#include "sql/statement.h"
#include "sql/transaction.h"

namespace fennec {

// ── Schema ─────────────────────────────────────────────────────────────────

namespace {

constexpr int kCurrentSchemaVersion = 2;

constexpr char kCreateMetaTable[] = R"sql(
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
)sql";

constexpr char kCreateRequestsTable[] = R"sql(
  CREATE TABLE IF NOT EXISTS requests (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp        INTEGER NOT NULL,
    url              TEXT    NOT NULL,
    resource_type    TEXT    NOT NULL DEFAULT '',
    source_url       TEXT    NOT NULL DEFAULT '',
    initiator_url    TEXT    NOT NULL DEFAULT '',
    source_tag       TEXT    NOT NULL DEFAULT 'page',
    status_code      INTEGER NOT NULL DEFAULT 0,
    mime_type        TEXT    NOT NULL DEFAULT '',
    blocked          INTEGER NOT NULL DEFAULT 0,
    block_reason     TEXT    NOT NULL DEFAULT '',
    resource_class   INTEGER NOT NULL DEFAULT 0,
    response_bytes   INTEGER NOT NULL DEFAULT -1
  );
)sql";

constexpr char kCreateUrlIndex[] =
    "CREATE INDEX IF NOT EXISTS idx_url ON requests(url);";
constexpr char kCreateTimestampIndex[] =
    "CREATE INDEX IF NOT EXISTS idx_ts ON requests(timestamp DESC);";
constexpr char kCreateClassIndex[] =
    "CREATE INDEX IF NOT EXISTS idx_class ON requests(resource_class);";

JournalEntry RowToEntry(sql::Statement& stmt) {
  JournalEntry e;
  e.id             = stmt.ColumnInt64(0);
  e.timestamp      = base::Time::FromInternalValue(stmt.ColumnInt64(1));
  e.url            = stmt.ColumnString(2);
  e.resource_type  = stmt.ColumnString(3);
  e.source_url     = stmt.ColumnString(4);
  e.initiator_url  = stmt.ColumnString(5);
  e.source_tag     = stmt.ColumnString(6);
  e.status_code    = stmt.ColumnInt(7);
  e.mime_type      = stmt.ColumnString(8);
  e.blocked        = stmt.ColumnBool(9);
  e.block_reason   = stmt.ColumnString(10);
  e.resource_class = static_cast<ResourceClass>(stmt.ColumnInt(11));
  e.response_bytes = stmt.ColumnInt64(12);
  return e;
}

constexpr char kSelectFields[] =
    "id, timestamp, url, resource_type, source_url, initiator_url, "
    "source_tag, status_code, mime_type, blocked, block_reason, "
    "resource_class, response_bytes";

}  // namespace

// ── ResourceClass label ─────────────────────────────────────────────────────

const char* ResourceClassLabel(ResourceClass cls) {
  switch (cls) {
    case ResourceClass::kFirstParty:       return "first-party";
    case ResourceClass::kThirdParty:       return "third-party";
    case ResourceClass::kTracker:          return "tracker";
    case ResourceClass::kAd:               return "ad";
    case ResourceClass::kTelemetry:        return "telemetry";
    case ResourceClass::kFingerprintProbe: return "fingerprint";
    case ResourceClass::kFennecInternal:   return "fennec-internal";
    case ResourceClass::kBlocked:          return "blocked";
  }
  return "unknown";
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

RequestJournal::RequestJournal(const base::FilePath& profile_path)
    : db_path_(profile_path
                   .AppendASCII("fennec")
                   .AppendASCII("request_journal.db")) {}

RequestJournal::~RequestJournal() = default;

bool RequestJournal::Initialize() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  base::FilePath dir = db_path_.DirName();
  if (!base::CreateDirectory(dir)) {
    LOG(ERROR) << "[RequestJournal] Cannot create directory: " << dir;
    return false;
  }

  db_.set_histogram_tag("FennecJournal");
  if (!db_.Open(db_path_)) {
    LOG(ERROR) << "[RequestJournal] Cannot open database: " << db_path_;
    return false;
  }

  // Enable WAL for concurrent read access from the WebUI thread.
  db_.Execute("PRAGMA journal_mode=WAL;");
  db_.Execute("PRAGMA synchronous=NORMAL;");

  if (!CreateSchema()) {
    LOG(ERROR) << "[RequestJournal] Schema creation failed.";
    return false;
  }

  LOG(INFO) << "[RequestJournal] Initialized at " << db_path_;
  return true;
}

bool RequestJournal::CreateSchema() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  sql::Transaction t(&db_);
  if (!t.Begin()) return false;

  if (!db_.Execute(kCreateMetaTable))      return false;
  if (!db_.Execute(kCreateRequestsTable))  return false;
  if (!db_.Execute(kCreateUrlIndex))       return false;
  if (!db_.Execute(kCreateTimestampIndex)) return false;
  if (!db_.Execute(kCreateClassIndex))     return false;

  // Persist schema version.
  sql::Statement upsert(db_.GetCachedStatement(SQL_FROM_HERE,
      "INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', ?)"));
  upsert.BindInt(0, kCurrentSchemaVersion);
  if (!upsert.Run()) return false;

  return t.Commit();
}

// ── Write API ──────────────────────────────────────────────────────────────

int64_t RequestJournal::RecordRequest(
    const std::string& url,
    const std::string& resource_type,
    const std::string& source_url,
    const std::string& initiator_url,
    const std::string& source_tag,
    ResourceClass resource_class) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    INSERT INTO requests
      (timestamp, url, resource_type, source_url, initiator_url,
       source_tag, resource_class)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  )sql"));

  const int64_t ts = base::Time::Now().ToInternalValue();
  stmt.BindInt64(0, ts);
  stmt.BindString(1, url);
  stmt.BindString(2, resource_type);
  stmt.BindString(3, source_url);
  stmt.BindString(4, initiator_url);
  stmt.BindString(5, source_tag);
  stmt.BindInt(6, static_cast<int>(resource_class));

  if (!stmt.Run()) {
    LOG(WARNING) << "[RequestJournal] RecordRequest failed for: " << url;
    return -1;
  }

  int64_t entry_id = db_.GetLastInsertRowId();

  // Build a partial entry to notify observers.
  JournalEntry entry;
  entry.id             = entry_id;
  entry.timestamp      = base::Time::FromInternalValue(ts);
  entry.url            = url;
  entry.resource_type  = resource_type;
  entry.source_url     = source_url;
  entry.initiator_url  = initiator_url;
  entry.source_tag     = source_tag;
  entry.resource_class = resource_class;
  entry.status_code    = 0;
  entry.blocked        = false;
  entry.response_bytes = -1;

  NotifyObservers(entry);
  return entry_id;
}

void RequestJournal::RecordResponse(int64_t entry_id,
                                    int status_code,
                                    const std::string& mime_type,
                                    int64_t response_bytes) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    UPDATE requests
       SET status_code = ?, mime_type = ?, response_bytes = ?
     WHERE id = ?
  )sql"));

  stmt.BindInt(0, status_code);
  stmt.BindString(1, mime_type);
  stmt.BindInt64(2, response_bytes);
  stmt.BindInt64(3, entry_id);
  stmt.Run();
}

void RequestJournal::RecordBlock(int64_t entry_id, const std::string& reason) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    UPDATE requests
       SET blocked = 1, block_reason = ?, resource_class = ?
     WHERE id = ?
  )sql"));

  stmt.BindString(0, reason);
  stmt.BindInt(1, static_cast<int>(ResourceClass::kBlocked));
  stmt.BindInt64(2, entry_id);
  stmt.Run();
}

// ── Read API ───────────────────────────────────────────────────────────────

std::vector<JournalEntry> RequestJournal::GetRecentEntries(int limit) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
      base::StringPrintf(
          "SELECT %s FROM requests ORDER BY id DESC LIMIT ?",
          kSelectFields).c_str()));
  stmt.BindInt(0, limit);

  std::vector<JournalEntry> entries;
  while (stmt.Step())
    entries.push_back(RowToEntry(stmt));
  return entries;
}

std::vector<JournalEntry> RequestJournal::GetEntriesByClass(
    ResourceClass filter_class, int limit) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  // kBlocked maps to blocked=1 rather than resource_class=7.
  const bool is_blocked = (filter_class == ResourceClass::kBlocked);

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
      base::StringPrintf(
          "SELECT %s FROM requests WHERE %s ORDER BY id DESC LIMIT ?",
          kSelectFields,
          is_blocked ? "blocked = 1"
                     : "resource_class = ?").c_str()));

  if (!is_blocked)
    stmt.BindInt(0, static_cast<int>(filter_class));
  else
    stmt.BindInt(0, limit);  // The LIMIT binding is always last.

  // Fix binding index when not blocked.
  if (!is_blocked) {
    // Re-bind with correct index.
    sql::Statement stmt2(db_.GetCachedStatement(SQL_FROM_HERE,
        base::StringPrintf(
            "SELECT %s FROM requests WHERE resource_class = ? "
            "ORDER BY id DESC LIMIT ?",
            kSelectFields).c_str()));
    stmt2.BindInt(0, static_cast<int>(filter_class));
    stmt2.BindInt(1, limit);

    std::vector<JournalEntry> entries;
    while (stmt2.Step())
      entries.push_back(RowToEntry(stmt2));
    return entries;
  }

  std::vector<JournalEntry> entries;
  while (stmt.Step())
    entries.push_back(RowToEntry(stmt));
  return entries;
}

std::string RequestJournal::ExportAsJson(int days) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  const int64_t cutoff = (base::Time::Now() - base::Days(days))
                             .ToInternalValue();

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
      base::StringPrintf(
          "SELECT %s FROM requests WHERE timestamp >= ? ORDER BY id DESC",
          kSelectFields).c_str()));
  stmt.BindInt64(0, cutoff);

  base::Value::List list;
  while (stmt.Step()) {
    JournalEntry e = RowToEntry(stmt);
    base::Value::Dict obj;
    obj.Set("id",             base::Value(static_cast<double>(e.id)));
    obj.Set("timestamp",      e.timestamp.ToJsTimeIgnoringNull());
    obj.Set("url",            e.url);
    obj.Set("resource_type",  e.resource_type);
    obj.Set("source_url",     e.source_url);
    obj.Set("initiator_url",  e.initiator_url);
    obj.Set("source_tag",     e.source_tag);
    obj.Set("status_code",    e.status_code);
    obj.Set("mime_type",      e.mime_type);
    obj.Set("blocked",        e.blocked);
    obj.Set("block_reason",   e.block_reason);
    obj.Set("resource_class", ResourceClassLabel(e.resource_class));
    obj.Set("response_bytes", base::Value(static_cast<double>(e.response_bytes)));
    list.Append(std::move(obj));
  }

  std::string json;
  base::JSONWriter::WriteWithOptions(
      base::Value(std::move(list)),
      base::JSONWriter::OPTIONS_PRETTY_PRINT,
      &json);
  return json;
}

void RequestJournal::PruneOlderThan(int days) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  const int64_t cutoff = (base::Time::Now() - base::Days(days))
                             .ToInternalValue();

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
      "DELETE FROM requests WHERE timestamp < ?"));
  stmt.BindInt64(0, cutoff);
  stmt.Run();

  // Compact the file occasionally.
  db_.Execute("PRAGMA incremental_vacuum(100);");
}

void RequestJournal::Clear() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  db_.Execute("DELETE FROM requests;");
  db_.Execute("VACUUM;");
}

// ── Observer API ───────────────────────────────────────────────────────────

int RequestJournal::Subscribe(
    RequestJournalObserver* observer,
    scoped_refptr<base::SequencedTaskRunner> task_runner) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  DCHECK(observer);

  int id = next_subscription_id_++;
  subscriptions_.push_back({id, observer, std::move(task_runner)});
  return id;
}

void RequestJournal::Unsubscribe(int subscription_id) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  subscriptions_.erase(
      std::remove_if(subscriptions_.begin(), subscriptions_.end(),
                     [subscription_id](const Subscription& s) {
                       return s.id == subscription_id;
                     }),
      subscriptions_.end());
}

void RequestJournal::NotifyObservers(const JournalEntry& entry) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  for (const Subscription& sub : subscriptions_) {
    // Post to the subscriber's task runner to avoid re-entrancy.
    sub.task_runner->PostTask(
        FROM_HERE,
        base::BindOnce(
            [](RequestJournalObserver* obs, JournalEntry e) {
              obs->OnNewEntry(e);
            },
            sub.observer, entry));
  }
}

}  // namespace fennec
