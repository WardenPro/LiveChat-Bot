import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeSettingsMocks = vi.hoisted(() => {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('fs', () => {
  return {
    promises: {
      readFile: runtimeSettingsMocks.readFile,
      writeFile: runtimeSettingsMocks.writeFile,
    },
  };
});

const loadRuntimeSettingsModule = async () => {
  vi.resetModules();
  return await import('../../../src/services/runtimeSettings');
};

describe('services/runtimeSettings', () => {
  const originalTikTokCookie = process.env.TIKTOK_COOKIE;

  beforeEach(() => {
    runtimeSettingsMocks.readFile.mockReset();
    runtimeSettingsMocks.writeFile.mockReset();
    runtimeSettingsMocks.writeFile.mockResolvedValue(undefined);
    process.env.TIKTOK_COOKIE = 'cookie: sessionid=boot-cookie';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalTikTokCookie === undefined) {
      delete process.env.TIKTOK_COOKIE;
    } else {
      process.env.TIKTOK_COOKIE = originalTikTokCookie;
    }
  });

  it('normalizes cookie values at runtime and when setting new values', async () => {
    const { getRuntimeTikTokCookie, setRuntimeTikTokCookie } = await loadRuntimeSettingsModule();

    expect(getRuntimeTikTokCookie()).toBe('sessionid=boot-cookie');
    expect(setRuntimeTikTokCookie('cookie: auth_token=next')).toBe('auth_token=next');
    expect(getRuntimeTikTokCookie()).toBe('auth_token=next');
  });

  it('upserts TIKTOK_COOKIE in .env content and persists escaped values', async () => {
    runtimeSettingsMocks.readFile.mockResolvedValue('API_URL=https://api.example\nTIKTOK_COOKIE=old\n');
    const { persistRuntimeTikTokCookieToEnvFile } = await loadRuntimeSettingsModule();

    const savedValue = await persistRuntimeTikTokCookieToEnvFile('cookie: new"value\\token');

    expect(savedValue).toBe('new"value\\token');
    expect(runtimeSettingsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.env'),
      expect.stringContaining('TIKTOK_COOKIE="new\\"value\\\\token"'),
      'utf8',
    );
  });

  it('creates .env content when file does not exist and propagates unexpected read failures', async () => {
    runtimeSettingsMocks.readFile.mockRejectedValueOnce({
      code: 'ENOENT',
    });

    const { persistRuntimeTikTokCookieToEnvFile } = await loadRuntimeSettingsModule();
    await persistRuntimeTikTokCookieToEnvFile('');

    expect(runtimeSettingsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/.env'),
      'TIKTOK_COOKIE=\n',
      'utf8',
    );

    runtimeSettingsMocks.readFile.mockRejectedValueOnce(new Error('EACCES'));
    await expect(persistRuntimeTikTokCookieToEnvFile('token')).rejects.toThrow('EACCES');
  });
});
