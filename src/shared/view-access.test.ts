import { describe, expect, it, vi } from 'vitest';
import { canAccessView } from './view-access';
import { View } from './types';

describe('view access', () => {
  it('keeps WIP hidden unless the feature flag is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_WIP', 'false');
    expect(canAccessView('System Admin', View.WIP_MANAGEMENT)).toBe(false);
  });

  it('restricts settings to system admins', () => {
    expect(canAccessView('System Admin', View.SETTINGS)).toBe(true);
    expect(canAccessView('Asset Manager', View.SETTINGS)).toBe(false);
  });
});
