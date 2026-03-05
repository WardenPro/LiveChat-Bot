import { hashOverlayToken } from '../../services/overlayAuth';

import type { OverlaySocket, OverlaySocketAuthContext, OverlaySocketClientRecord } from './types';
import { normalizeOverlaySessionMode, toNonEmptyString } from './valueUtils';

const getTokenFromSocketHandshake = (socket: OverlaySocket): string | null => {
  const authToken = socket.handshake?.auth?.token;

  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const queryToken = socket.handshake?.query?.token;

  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
};

const resolveOverlayClientByToken = async (token: string): Promise<OverlaySocketClientRecord | null> => {
  const tokenHash = hashOverlayToken(token);

  return (await prisma.overlayClient.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
  })) as OverlaySocketClientRecord | null;
};

const buildSocketAuthContext = (socket: OverlaySocket, client: OverlaySocketClientRecord): OverlaySocketAuthContext => {
  const sessionModeFromHandshake = toNonEmptyString(socket.handshake?.auth?.sessionMode);
  const sessionModeFromClient = client.sessionMode;

  return {
    guildId: client.guildId,
    overlayClientId: client.id,
    overlayClientLabel: client.label,
    overlaySessionMode: normalizeOverlaySessionMode(sessionModeFromHandshake || sessionModeFromClient),
    overlayAuthorName: toNonEmptyString(client.defaultAuthorName),
    overlayAuthorImage: toNonEmptyString(client.defaultAuthorImage),
  };
};

const applySocketAuthContext = (socket: OverlaySocket, context: OverlaySocketAuthContext) => {
  socket.data.guildId = context.guildId;
  socket.data.overlayClientId = context.overlayClientId;
  socket.data.overlayClientLabel = context.overlayClientLabel;
  socket.data.overlaySessionMode = context.overlaySessionMode;
  socket.data.overlayAuthorName = context.overlayAuthorName;
  socket.data.overlayAuthorImage = context.overlayAuthorImage;
};

export const registerOverlaySocketAuthentication = (fastify: FastifyCustomInstance) => {
  fastify.io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocketHandshake(socket);

      if (!token) {
        logger.warn({ socketId: socket.id }, '[OVERLAY] Socket auth failed: missing token');
        next(new Error('missing_token'));
        return;
      }

      const client = await resolveOverlayClientByToken(token);

      if (!client) {
        logger.warn({ socketId: socket.id }, '[OVERLAY] Socket auth failed: invalid token');
        next(new Error('invalid_token'));
        return;
      }

      const context = buildSocketAuthContext(socket, client);
      applySocketAuthContext(socket, context);

      await prisma.overlayClient.update({
        where: {
          id: client.id,
        },
        data: {
          lastSeenAt: new Date(),
        },
      });

      next();
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, '[OVERLAY] Socket auth error');
      next(new Error('auth_error'));
    }
  });
};
