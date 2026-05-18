/**
 * Role-based permissions for QET Asset Management System
 * B. Asset Manager, C. Custodian, D. Audit User (+ System Admin)
 */

import { UserRole } from "@/types";

export type Permission =
  | "register_asset"
  | "edit_asset"
  | "delete_asset"
  | "approve_transfer"
  | "initiate_transfer"
  | "assign_custodian"
  | "start_wip"
  | "assign_project_manager"
  | "view_all_reports"
  | "view_scoped_reports"
  | "export_reports"
  | "view_audit_logs"
  | "update_condition"
  | "manage_users"
  | "edit_users"
  | "delete_users"
  | "system_settings"
  | "start_audit"
  | "record_audit";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  "System Admin": [
    "register_asset",
    "edit_asset",
    "delete_asset",
    "approve_transfer",
    "initiate_transfer",
    "assign_custodian",
    "start_wip",
    "assign_project_manager",
    "view_all_reports",
    "export_reports",
    "view_audit_logs",
    "manage_users",
    "edit_users",
    "delete_users",
    "system_settings",
  ],
  "Asset Manager": [
    "register_asset",
    "edit_asset",
    "approve_transfer",
    "initiate_transfer",
    "assign_custodian",
    "start_wip",
    "assign_project_manager",
    "view_all_reports",
    "export_reports",
    "view_audit_logs",
    "manage_users",
    "edit_users",
  ],
  Custodian: [
    "edit_asset",
    "initiate_transfer",
    "assign_custodian",
    "update_condition",
    "view_scoped_reports",
    "export_reports",
    "manage_users",
  ],
  Auditor: [
    "view_all_reports",
    "export_reports",
    "view_audit_logs",
    "manage_users",
    "start_audit",
    "record_audit",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

export function canApproveTransfer(role: UserRole): boolean {
  return hasPermission(role, "approve_transfer");
}

export function canInitiateTransfer(role: UserRole): boolean {
  return hasPermission(role, "initiate_transfer");
}

export function canRegisterAsset(role: UserRole): boolean {
  return hasPermission(role, "register_asset");
}

export function canEditAsset(role: UserRole): boolean {
  return hasPermission(role, "edit_asset");
}

export function canDeleteAsset(role: UserRole): boolean {
  return hasPermission(role, "delete_asset");
}

export function canEditUsers(role: UserRole): boolean {
  return hasPermission(role, "edit_users");
}

export function canDeleteUsers(role: UserRole): boolean {
  return hasPermission(role, "delete_users");
}

export function canAccessSystemSettings(role: UserRole): boolean {
  return hasPermission(role, "system_settings");
}

export function canAccessScopedReports(role: UserRole): boolean {
  return hasPermission(role, "view_scoped_reports");
}

export function canAccessAllReports(role: UserRole): boolean {
  return hasPermission(role, "view_all_reports");
}

export function canStartWip(role: UserRole): boolean {
  return hasPermission(role, "start_wip");
}

export function canAssignProjectManager(role: UserRole): boolean {
  return hasPermission(role, "assign_project_manager");
}

export function canStartAudit(role: UserRole): boolean {
  return hasPermission(role, "start_audit");
}

export function canRecordAudit(role: UserRole): boolean {
  return hasPermission(role, "record_audit");
}
