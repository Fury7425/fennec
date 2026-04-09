// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.
//
// WorkspaceManager — per-profile SQLite-backed workspace state.
// Backs the vertical sidebar workspace switcher (Calm UI pillar).

#ifndef FENNEC_WORKSPACES_WORKSPACE_MANAGER_H_
#define FENNEC_WORKSPACES_WORKSPACE_MANAGER_H_

#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/time/time.h"
#include "sql/database.h"

namespace fennec {

struct Workspace {
  int64_t      id;
  std::string  name;
  std::string  icon;              // Emoji or icon name
  std::string  chrome_tint_hex;  // e.g. "#E8672A"
  std::vector<int> tab_ids;
  base::Time   created_at;
  base::Time   last_active_at;
  bool         is_active;
};

class WorkspaceManager {
 public:
  explicit WorkspaceManager(const base::FilePath& profile_path);
  ~WorkspaceManager();

  WorkspaceManager(const WorkspaceManager&) = delete;
  WorkspaceManager& operator=(const WorkspaceManager&) = delete;

  bool Initialize();

  // CRUD
  int64_t     CreateWorkspace(const std::string& name, const std::string& icon);
  bool        DeleteWorkspace(int64_t id);
  std::vector<Workspace> GetWorkspaces();

  // Activation
  bool        SetActiveWorkspace(int64_t id);
  int64_t     GetActiveWorkspaceId();

  // Tab membership
  bool        AddTabToWorkspace(int tab_id, int64_t workspace_id);
  bool        RemoveTabFromWorkspace(int tab_id, int64_t workspace_id);
  std::vector<int> GetTabsInWorkspace(int64_t workspace_id);

  // Suspends tabs in all non-active workspaces.
  void        SuspendInactiveTabs();

 private:
  bool CreateSchema();

  base::FilePath db_path_;
  sql::Database  db_;
  int64_t        active_workspace_id_ = -1;
};

}  // namespace fennec

#endif  // FENNEC_WORKSPACES_WORKSPACE_MANAGER_H_
