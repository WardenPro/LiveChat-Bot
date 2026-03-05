import type { OverlayConnectionPeer, OverlayConnectionState, OverlayPlaybackScheduler, OverlaySocket } from './types';
import { getOverlayRoomName, getOverlaySocketLabel, toNonEmptyString } from './valueUtils';
import { OVERLAY_SOCKET_EVENTS } from '@livechat/overlay-protocol';

interface CreateOverlayConnectionStateParams {
  fastify: FastifyCustomInstance;
  playbackScheduler: OverlayPlaybackScheduler;
}

const listConnectedOverlayPeers = async (
  fastify: FastifyCustomInstance,
  guildId: string,
): Promise<OverlayConnectionPeer[]> => {
  const roomName = getOverlayRoomName(guildId);
  const sockets = await fastify.io.in(roomName).fetchSockets();
  const peersByClientId = new Map<string, OverlayConnectionPeer>();

  for (const roomSocket of sockets) {
    const clientId = toNonEmptyString(roomSocket.data?.overlayClientId) || '';
    const label = getOverlaySocketLabel(roomSocket.data);

    if (!clientId || peersByClientId.has(clientId)) {
      continue;
    }

    peersByClientId.set(clientId, {
      clientId,
      label,
    });
  }

  return Array.from(peersByClientId.values()).sort((left, right) => {
    const labelOrder = left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    if (labelOrder !== 0) {
      return labelOrder;
    }

    return left.clientId.localeCompare(right.clientId, undefined, { sensitivity: 'base' });
  });
};

export const createOverlayConnectionState = ({
  fastify,
  playbackScheduler,
}: CreateOverlayConnectionStateParams): OverlayConnectionState => {
  const broadcastPeers = async (guildId: string) => {
    const peers = await listConnectedOverlayPeers(fastify, guildId);
    const roomName = getOverlayRoomName(guildId);

    fastify.io.to(roomName).emit(OVERLAY_SOCKET_EVENTS.PEERS, {
      guildId,
      peers,
    });

    logger.debug(`[OVERLAY] Peers updated for guild ${guildId} (count: ${peers.length})`);
  };

  const onConnected = (socket: OverlaySocket, guildId: string) => {
    const roomName = getOverlayRoomName(guildId);
    socket.join(roomName);

    const roomSize = fastify.io.sockets.adapter.rooms.get(roomName)?.size ?? 0;
    const clientLabel = socket.data.overlayClientLabel || 'unknown-device';
    logger.info(
      `[OVERLAY] Connected: ${clientLabel} (clientId: ${socket.data.overlayClientId}, socket: ${socket.id}, guild: ${guildId}, roomSize: ${roomSize})`,
    );

    void playbackScheduler.onJobEnqueued(guildId).catch((error) => {
      logger.warn({ err: error, guildId }, '[PLAYBACK] Failed to run scheduler after overlay connect');
    });

    void broadcastPeers(guildId).catch((error) => {
      logger.warn({ err: error, guildId }, '[OVERLAY] Failed to broadcast peers after connect');
    });
  };

  const onDisconnecting = (socket: OverlaySocket, guildId: string) => {
    logger.info(
      `[OVERLAY] Disconnected: ${socket.data.overlayClientLabel || 'unknown-device'} (clientId: ${
        socket.data.overlayClientId
      }, socket: ${socket.id}, guild: ${guildId})`,
    );
  };

  const onDisconnected = async (socket: OverlaySocket, guildId: string, reason: string) => {
    const roomName = getOverlayRoomName(guildId);
    const remainingClients = fastify.io.sockets.adapter.rooms.get(roomName)?.size ?? 0;

    await broadcastPeers(guildId).catch((error) => {
      logger.warn({ err: error, guildId }, '[OVERLAY] Failed to broadcast peers after disconnect');
    });

    if (remainingClients > 0) {
      return;
    }

    await prisma.guild.upsert({
      where: {
        id: guildId,
      },
      create: {
        id: guildId,
        busyUntil: null,
      },
      update: {
        busyUntil: null,
      },
    });

    logger.info(
      `[OVERLAY] Cleared busyUntil after disconnect (guild: ${guildId}, reason: ${reason}, remainingClients: ${remainingClients})`,
    );
  };

  return {
    onConnected,
    onDisconnecting,
    onDisconnected,
    broadcastPeers,
  };
};
