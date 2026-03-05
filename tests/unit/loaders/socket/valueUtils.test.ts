import { describe, expect, it } from 'vitest';

import {
  getOverlayRoomName,
  getOverlaySocketLabel,
  normalizeOverlaySessionMode,
} from '../../../../src/loaders/socket/valueUtils';

describe('loaders/socket/valueUtils', () => {
  it('normalizes invite read-only session mode from mixed casing', () => {
    expect(normalizeOverlaySessionMode('  INVITE_READ_ONLY  ')).toBe('invite_read_only');
  });

  it('falls back to normal mode for unsupported session values', () => {
    expect(normalizeOverlaySessionMode('legacy')).toBe('normal');
    expect(normalizeOverlaySessionMode(undefined)).toBe('normal');
  });

  it('prefers author name over device label when resolving socket label', () => {
    const socketData: SocketData = {
      overlayAuthorName: '  Stream Host  ',
      overlayClientLabel: 'Control Tablet',
    };

    expect(getOverlaySocketLabel(socketData)).toBe('Stream Host');
  });

  it('returns unknown-device when no socket labels are available', () => {
    const socketData: SocketData = {
      overlayAuthorName: '   ',
      overlayClientLabel: '',
    };

    expect(getOverlaySocketLabel(socketData)).toBe('unknown-device');
  });

  it('builds room names using the guild prefix contract', () => {
    expect(getOverlayRoomName('guild-42')).toBe('overlay-guild-guild-42');
  });
});
