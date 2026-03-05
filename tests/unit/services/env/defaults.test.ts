import { describe, expect, it } from 'vitest';

import { ENV_DEFAULTS, LOG_LEVELS, MEDIA_VIDEO_ENCODERS } from '../../../../src/services/env/defaults';

describe('env/defaults', () => {
  it('exposes stable default values used by runtime config parsing', () => {
    expect(ENV_DEFAULTS.NODE_ENV).toBe('development');
    expect(ENV_DEFAULTS.LOG).toBe('info');
    expect(ENV_DEFAULTS.PORT).toBe(3000);
    expect(ENV_DEFAULTS.ADMIN_UI_LOCAL_ONLY).toBe(true);
    expect(ENV_DEFAULTS.MEDIA_AUDIO_LOUDNORM_TP).toBe(-1.5);

    expect(LOG_LEVELS).toEqual(['info', 'debug', 'error', 'silent', 'warning']);
    expect(MEDIA_VIDEO_ENCODERS).toEqual(['auto', 'libx264', 'h264_nvenc']);
  });

  it('does not expose unsupported values in enum-like lists', () => {
    expect(LOG_LEVELS).not.toContain('trace');
    expect(MEDIA_VIDEO_ENCODERS).not.toContain('vp9');
  });
});
