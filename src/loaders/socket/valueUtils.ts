import { parseNonEmptyStringOrUndefined } from '../../services/validation/requestParsing';
import type { OverlaySessionMode } from '@livechat/overlay-protocol';

export const toNonEmptyString = parseNonEmptyStringOrUndefined;

export const normalizeOverlaySessionMode = (value: unknown): OverlaySessionMode => {
  if (typeof value === 'string' && value.trim().toLowerCase() === 'invite_read_only') {
    return 'invite_read_only';
  }

  return 'normal';
};

export const getOverlaySocketLabel = (socketData: SocketData): string => {
  const authorLabel = toNonEmptyString(socketData.overlayAuthorName);
  const deviceLabel = toNonEmptyString(socketData.overlayClientLabel);

  return authorLabel || deviceLabel || 'unknown-device';
};

export const getOverlayRoomName = (guildId: string): string => {
  return `overlay-guild-${guildId}`;
};
