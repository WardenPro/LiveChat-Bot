import {
  buildSafeErrorLogContext,
  createSocketAuthOperationalError,
  mapErrorToSocketAuthOutput,
} from '../../services/errors/runtimeErrorHandling';
import { resolveOverlayAuthFromToken } from '../../services/overlayAuth';
import { parseRequestField } from '../../services/validation/requestParsing';

import type { OverlaySocket, OverlaySocketAuthContext, OverlaySocketClientRecord } from './types';
import { normalizeOverlaySessionMode, toNonEmptyString } from './valueUtils';

const getTokenFromSocketHandshake = (socket: OverlaySocket): string | null => {
  const authToken = parseRequestField(socket.handshake?.auth, 'token', toNonEmptyString);
  if (authToken) {
    return authToken;
  }

  return parseRequestField(socket.handshake?.query, 'token', toNonEmptyString) || null;
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
      const authResult = await resolveOverlayAuthFromToken(token, 'socket_handshake');

      if (authResult.kind !== 'authenticated') {
        const authFailureCode = authResult.kind === 'missing_token' ? 'missing_token' : 'invalid_token';
        const mapped = forwardSocketAuthError(
          createSocketAuthOperationalError(authFailureCode, { socketId: socket.id }),
          next,
        );
        logger.warn(
          { socketId: socket.id, category: mapped.category },
          `[OVERLAY] Socket auth failed: ${authFailureCode.replace('_', ' ')}`,
        );
        return;
      }

      const client = authResult.client;
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
