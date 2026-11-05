import { beforeEach, describe, expect, it, vi } from 'vitest';

const impact = vi.fn(() => Promise.resolve());
const notification = vi.fn(() => Promise.resolve());

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS' },
}));

const { createHapticsBackend } = await import('../src/platform/haptics');

beforeEach(() => {
  impact.mockClear();
  notification.mockClear();
});

describe('native haptics backend (Android app)', () => {
  it('maps each kind to the matching native feedback', () => {
    const backend = createHapticsBackend();
    backend?.play('light');
    backend?.play('medium');
    backend?.play('heavy');
    backend?.play('success');
    expect(impact).toHaveBeenNthCalledWith(1, { style: 'LIGHT' });
    expect(impact).toHaveBeenNthCalledWith(2, { style: 'MEDIUM' });
    expect(impact).toHaveBeenNthCalledWith(3, { style: 'HEAVY' });
    expect(notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
  });

  it('swallows a rejection from a device with no vibration motor', async () => {
    impact.mockImplementationOnce(() => Promise.reject(new Error('no motor')));
    const backend = createHapticsBackend();
    expect(() => backend?.play('light')).not.toThrow();
    await Promise.resolve();
  });
});
