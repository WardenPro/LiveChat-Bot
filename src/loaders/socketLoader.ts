import { OVERLAY_SOCKET_EVENTS, type OverlayErrorPayload, type OverlayHeartbeatPayload } from '@livechat/overlay-protocol';
import { hashOverlayToken } from '../services/overlayAuth';

const getTokenFromSocketHandshake = (socket) => {
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

const RELEASE_BUSY_ERROR_CODES = new Set(['manual_stop', 'media_load_failed', 'autoplay_failed', 'render_failed']);

export const loadSocket = (fastify: FastifyCustomInstance) => {
  logger.info(`[Socket] Socket loaded`);

  fastify.io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocketHandshake(socket);

      if (!token) {
        next(new Error('missing_token'));
        return;
      }

      const tokenHash = hashOverlayToken(token);

      const client = await prisma.overlayClient.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
        },
      });

      if (!client) {
        next(new Error('invalid_token'));
        return;
      }

      socket.data.guildId = client.guildId;
      socket.data.overlayClientId = client.id;

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
      next(new Error('auth_error'));
    }
  });

  fastify.io.on('connection', (socket) => {
    const guildId = socket.data.guildId;

    if (!guildId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`overlay-guild-${guildId}`);

    logger.debug(`Overlay connected: ${socket.id} (guild: ${guildId})`);

    socket.on(OVERLAY_SOCKET_EVENTS.HEARTBEAT, async (payload: OverlayHeartbeatPayload) => {
      logger.debug(`Heartbeat from client ${payload?.clientId || socket.data.overlayClientId} (${socket.id})`);

      await prisma.overlayClient.updateMany({
        where: {
          id: socket.data.overlayClientId,
          guildId: socket.data.guildId,
          revokedAt: null,
        },
        data: {
          lastSeenAt: new Date(),
        },
      });
    });

    socket.on(OVERLAY_SOCKET_EVENTS.ERROR, async (payload: OverlayErrorPayload) => {
      logger.warn(
        `[OVERLAY] Error from client ${socket.data.overlayClientId} on job ${payload?.jobId}: ${payload?.code} ${payload?.message}`,
      );

      const normalizedCode = `${payload?.code || ''}`.toLowerCase().trim();

      if (!RELEASE_BUSY_ERROR_CODES.has(normalizedCode)) {
        return;
      }

      try {
        await prisma.guild.updateMany({
          where: {
            id: socket.data.guildId,
          },
          data: {
            busyUntil: null,
          },
        });

        logger.info(
          `[OVERLAY] Released busy lock for guild ${socket.data.guildId} after ${normalizedCode} (job ${payload?.jobId})`,
        );
      } catch (error) {
        logger.error(error, `[OVERLAY] Failed to release busy lock for guild ${socket.data.guildId}`);
      }
    });

    socket.on('disconnecting', () => {
      logger.debug(`Overlay disconnected: ${socket.id}`);
    });
  });
};
