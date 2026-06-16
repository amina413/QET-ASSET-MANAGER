import { hasPermission } from '@/shared/permissions';
import { UserRole, View } from '@/shared/types';

export function isWipManagementEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_WIP === 'true';
}

export function canAccessView(role: UserRole, view: View): boolean {
  switch (view) {
    case View.DASHBOARD:
    case View.ASSET_LOOKUP:
    case View.PROFILE:
      return true;
    case View.ASSET_REGISTRATION:
      return hasPermission(role, 'register_asset');
    case View.ASSET_MANAGEMENT:
      return hasPermission(role, 'edit_asset');
    case View.WIP_MANAGEMENT:
      return isWipManagementEnabled() && hasPermission(role, 'start_wip');
    case View.REPORTS:
      return hasPermission(role, 'view_all_reports') || hasPermission(role, 'view_scoped_reports');
    case View.USER_MANAGEMENT:
      return hasPermission(role, 'manage_users');
    case View.AUDIT:
      return hasPermission(role, 'start_audit') || hasPermission(role, 'record_audit');
    case View.SETTINGS:
      return hasPermission(role, 'system_settings');
    case View.LOGIN:
    default:
      return false;
  }
}
