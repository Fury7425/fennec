// Types mirroring the C++ sidebar data structures.
// Serialised by sidebar_mojo_handler.cc and consumed by the React sidebar UI.

export interface SidebarTab {
  id: number;
  title: string;
  url: string;
  favIconUrl: string;
  active: boolean;
  pinned: boolean;
  workspaceId: number;
  loading: boolean;
  audible: boolean;
  muted: boolean;
}

export interface Workspace {
  id: number;
  name: string;
  /** One of the --fnc-workspace-* color names, e.g. "orange", "blue". */
  color: string;
}

export type SidebarEvent =
  | { type: 'TAB_ADDED';          tab: SidebarTab }
  | { type: 'TAB_REMOVED';        tabId: number }
  | { type: 'TAB_UPDATED';        tab: SidebarTab }
  | { type: 'TAB_ACTIVATED';      tabId: number }
  | { type: 'WORKSPACE_CHANGED';  workspaceId: number }
  | { type: 'WORKSPACE_ADDED';    workspace: Workspace }
  | { type: 'WORKSPACE_REMOVED';  workspaceId: number };
