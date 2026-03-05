import { getPlaybackScheduler } from '../services/playbackScheduler';

import { registerOverlaySocketAuthentication } from './socket/socketAuthentication';
import { createOverlayConnectionState } from './socket/socketConnectionState';
import { createOverlaySocketEventDispatcher } from './socket/socketEventDispatch';

export const loadSocket = (fastify: FastifyCustomInstance) => {
  logger.info(`[Socket] Socket loaded`);
  const playbackScheduler = getPlaybackScheduler();

  if (!playbackScheduler) {
    throw new Error('playback_scheduler_not_initialized');
  }

  registerOverlaySocketAuthentication(fastify);

  const connectionState = createOverlayConnectionState({
    fastify,
    playbackScheduler,
  });
  const eventDispatcher = createOverlaySocketEventDispatcher({
    fastify,
    playbackScheduler,
    connectionState,
  });

  fastify.io.on('connection', (socket) => {
    const guildId = socket.data.guildId;

    if (!guildId) {
      socket.disconnect(true);
      return;
    }

    connectionState.onConnected(socket, guildId);
    eventDispatcher.registerHandlers(socket, guildId);
  });
};
