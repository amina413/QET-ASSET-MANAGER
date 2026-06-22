import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions';

describe('role permissions', () => {
  it('does not grant system settings access to Asset Managers', () => {
    expect(hasPermission('Asset Manager', 'system_settings')).toBe(false);
  });

  it('allows Custodians to update condition codes but not approve transfers', () => {
    expect(hasPermission('Custodian', 'update_condition')).toBe(true);
    expect(hasPermission('Custodian', 'approve_transfer')).toBe(false);
  });

  it('keeps financial and lifecycle permissions away from Custodians', () => {
    expect(hasPermission('Custodian', 'adjust_asset_value')).toBe(false);
    expect(hasPermission('Custodian', 'change_asset_status')).toBe(false);
    expect(hasPermission('Asset Manager', 'adjust_asset_value')).toBe(true);
    expect(hasPermission('Asset Manager', 'change_asset_status')).toBe(true);
  });
});
