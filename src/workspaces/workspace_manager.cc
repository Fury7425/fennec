// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.

#include "fennec/workspaces/workspace_manager.h"

#include "base/files/file_util.h"
#include "base/logging.h"
#include "sql/statement.h"
#include "sql/transaction.h"

namespace fennec {

WorkspaceManager::WorkspaceManager(const base::FilePath& profile_path)
    : db_path_(profile_path.AppendASCII("fennec").AppendASCII("workspaces.db")) {}

WorkspaceManager::~WorkspaceManager() = default;

bool WorkspaceManager::Initialize() {
  if (!base::CreateDirectory(db_path_.DirName())) {
    LOG(ERROR) << "WorkspaceManager: could not create directory";
    return false;
  }
  if (!db_.Open(db_path_)) {
    LOG(ERROR) << "WorkspaceManager: could not open database";
    return false;
  }
  return CreateSchema();
}

bool WorkspaceManager::CreateSchema() {
  sql::Transaction t(&db_);
  if (!t.Begin()) return false;

  if (!db_.Execute(R"sql(
    CREATE TABLE IF NOT EXISTS workspaces (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      icon            TEXT    NOT NULL DEFAULT '',
      chrome_tint_hex TEXT    NOT NULL DEFAULT '',
      created_at      INTEGER NOT NULL,
      last_active_at  INTEGER NOT NULL,
      is_active       INTEGER NOT NULL DEFAULT 0
    );
  )sql")) return false;

  if (!db_.Execute(R"sql(
    CREATE TABLE IF NOT EXISTS workspace_tabs (
      workspace_id INTEGER NOT NULL,
      tab_id       INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, tab_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  )sql")) return false;

  return t.Commit();
}

int64_t WorkspaceManager::CreateWorkspace(const std::string& name,
                                           const std::string& icon) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    INSERT INTO workspaces (name, icon, created_at, last_active_at)
    VALUES (?, ?, ?, ?)
  )sql"));

  int64_t now = base::Time::Now().ToInternalValue();
  stmt.BindString(0, name);
  stmt.BindString(1, icon);
  stmt.BindInt64(2, now);
  stmt.BindInt64(3, now);

  if (!stmt.Run()) return -1;
  return db_.GetLastInsertRowId();
}

bool WorkspaceManager::DeleteWorkspace(int64_t id) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
    "DELETE FROM workspaces WHERE id = ?"));
  stmt.BindInt64(0, id);
  return stmt.Run();
}

std::vector<Workspace> WorkspaceManager::GetWorkspaces() {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE, R"sql(
    SELECT id, name, icon, chrome_tint_hex, created_at, last_active_at, is_active
    FROM workspaces ORDER BY id ASC
  )sql"));

  std::vector<Workspace> result;
  while (stmt.Step()) {
    Workspace w;
    w.id              = stmt.ColumnInt64(0);
    w.name            = stmt.ColumnString(1);
    w.icon            = stmt.ColumnString(2);
    w.chrome_tint_hex = stmt.ColumnString(3);
    w.created_at      = base::Time::FromInternalValue(stmt.ColumnInt64(4));
    w.last_active_at  = base::Time::FromInternalValue(stmt.ColumnInt64(5));
    w.is_active       = stmt.ColumnBool(6);
    w.tab_ids         = GetTabsInWorkspace(w.id);
    result.push_back(std::move(w));
  }
  return result;
}

bool WorkspaceManager::SetActiveWorkspace(int64_t id) {
  sql::Transaction t(&db_);
  if (!t.Begin()) return false;

  db_.Execute("UPDATE workspaces SET is_active = 0");

  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
    "UPDATE workspaces SET is_active = 1, last_active_at = ? WHERE id = ?"));
  stmt.BindInt64(0, base::Time::Now().ToInternalValue());
  stmt.BindInt64(1, id);
  if (!stmt.Run()) return false;

  active_workspace_id_ = id;
  return t.Commit();
}

int64_t WorkspaceManager::GetActiveWorkspaceId() {
  return active_workspace_id_;
}

bool WorkspaceManager::AddTabToWorkspace(int tab_id, int64_t workspace_id) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
    "INSERT OR IGNORE INTO workspace_tabs (workspace_id, tab_id) VALUES (?, ?)"));
  stmt.BindInt64(0, workspace_id);
  stmt.BindInt(1, tab_id);
  return stmt.Run();
}

bool WorkspaceManager::RemoveTabFromWorkspace(int tab_id, int64_t workspace_id) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
    "DELETE FROM workspace_tabs WHERE workspace_id = ? AND tab_id = ?"));
  stmt.BindInt64(0, workspace_id);
  stmt.BindInt(1, tab_id);
  return stmt.Run();
}

std::vector<int> WorkspaceManager::GetTabsInWorkspace(int64_t workspace_id) {
  sql::Statement stmt(db_.GetCachedStatement(SQL_FROM_HERE,
    "SELECT tab_id FROM workspace_tabs WHERE workspace_id = ?"));
  stmt.BindInt64(0, workspace_id);

  std::vector<int> tabs;
  while (stmt.Step()) tabs.push_back(stmt.ColumnInt(0));
  return tabs;
}

void WorkspaceManager::SuspendInactiveTabs() {
  // Tab suspension is implemented by the browser process via
  // TabStripModel::SuspendTabAt(). WorkspaceManager signals which tab IDs
  // to suspend; the Views layer owns the actual WebContents lifecycle.
  // TODO(fennec): Wire up to TabStripModel in Phase 2.
}

}  // namespace fennec
