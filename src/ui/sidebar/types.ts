import type { FennecTab, FennecWorkspace } from '../shared/models';

export type SidebarTab = FennecTab;

export interface Workspace extends FennecWorkspace {}

export type SidebarEvent =
  | { type: 'TAB_ADDED'; tab: SidebarTab }
  | { type: 'TAB_REMOVED'; tabId: number }
  | { type: 'TAB_UPDATED'; tab: SidebarTab }
  | { type: 'TAB_ACTIVATED'; tabId: number }
  | { type: 'WORKSPACE_CHANGED'; workspaceId: number }
  | { type: 'WORKSPACE_ADDED'; workspace: Workspace }
  | { type: 'WORKSPACE_REMOVED'; workspaceId: number };
