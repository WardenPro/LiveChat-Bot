import { hashOverlayToken } from '../../services/overlayAuth';
import { parseRequestField } from '../../services/validation/requestParsing';
import {
  buildSafeErrorLogContext,
  createSocketAuthOperationalError,
  mapErrorToSocketAuthOutput,
} from '../../services/errors/runtimeErrorHandling';

import type { OverlaySocket, OverlaySocketAuthContext, OverlaySocketClientRecord } from './types';
import { normalizeOverlaySessionMode, toNonEmptyString } from './valueUtils';

const getTokenFromSocketHandshake = (socket: OverlaySocket): string | null => {
  const authToken = parseRequestField(socket.handshake?.auth, 'token', toNonEmptyString);
  if (authToken) {
    return authToken;
  }

  return parseRequestField(socket.handshake?.query, 'token', toNonEmptyString) || null;
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
  const sessionModeFromHandshake = parseRequestField(socket.handshake?.auth, 'sessionMode', toNonEmptyString);
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

const forwardSocketAuthError = (error: unknown, next: (error?: Error) => void) => {
  const mapped = mapErrorToSocketAuthOutput(error);
  next(mapped.transportError);
  return mapped;
};

export const registerOverlaySocketAuthentication = (fastify: FastifyCustomInstance) => {
  fastify.io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocketHandshake(socket);

      if (!token) {
        const mapped = forwardSocketAuthError(
          createSocketAuthOperationalError('missing_token', { socketId: socket.id }),
          next,
        );
        logger.warn({ socketId: socket.id, category: mapped.category }, '[OVERLAY] Socket auth failed: missing token');
        return;
      }

      const client = await resolveOverlayClientByToken(token);

      if (!client) {
        const mapped = forwardSocketAuthError(
          createSocketAuthOperationalError('invalid_token', { socketId: socket.id }),
          next,
        );
        logger.warn({ socketId: socket.id, category: mapped.category }, '[OVERLAY] Socket auth failed: invalid token');
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
      const mapped = forwardSocketAuthError(error, next);
      const logContext = buildSafeErrorLogContext(error, {
        socketId: socket.id,
        category: mapped.category,
        socketCode: mapped.socketCode,
      });

      if (mapped.logLevel === 'warn') {
        logger.warn(logContext, '[OVERLAY] Socket auth error');
      } else {
        logger.error(logContext, '[OVERLAY] Socket auth error');
      }
    }
  });
};
