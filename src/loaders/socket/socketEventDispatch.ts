import { createPlaybackJob } from '../../services/playbackJobs';
import { MediaAssetStatus } from '../../services/prisma/prismaEnums';
import { MEME_JOB_PRIORITY } from '../../services/playbackScheduler';
import { executeManualStopForGuild } from '../../services/manualStop';

import type { OverlayConnectionState, OverlayPlaybackScheduler, OverlaySocket } from './types';
import { normalizeOverlaySessionMode, toNonEmptyString } from './valueUtils';
import {
  OVERLAY_SOCKET_EVENTS,
  type OverlayErrorPayload,
  type OverlayHeartbeatPayload,
  type OverlayMemeTriggerPayload,
  type OverlayPlaybackStatePayload,
  type OverlayStopPayload,
} from '@livechat/overlay-protocol';

interface CreateOverlaySocketEventDispatcherParams {
  fastify: FastifyCustomInstance;
  playbackScheduler: OverlayPlaybackScheduler;
  connectionState: OverlayConnectionState;
}

interface OverlaySocketEventDispatcher {
  registerHandlers(socket: OverlaySocket, guildId: string): void;
}

const resolvePlaybackState = (value: unknown): 'playing' | 'paused' | 'ended' => {
  if (value === 'paused' || value === 'ended' || value === 'playing') {
    return value;
  }

  return 'playing';
};

const resolvePlaybackRemainingMs = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(value, 24 * 60 * 60 * 1000));
};

export const createOverlaySocketEventDispatcher = ({
  fastify,
  playbackScheduler,
  connectionState,
}: CreateOverlaySocketEventDispatcherParams): OverlaySocketEventDispatcher => {
  const registerHandlers = (socket: OverlaySocket, guildId: string) => {
    socket.on(OVERLAY_SOCKET_EVENTS.HEARTBEAT, async (payload: OverlayHeartbeatPayload) => {
      const sessionModeFromHeartbeat = toNonEmptyString(payload?.sessionMode);
      if (sessionModeFromHeartbeat) {
        socket.data.overlaySessionMode = normalizeOverlaySessionMode(sessionModeFromHeartbeat);
      }

      logger.debug(
        `Heartbeat from ${socket.data.overlayClientLabel || 'unknown-device'} (${payload?.clientId || socket.data.overlayClientId}, socket: ${socket.id}, mode: ${socket.data.overlaySessionMode || 'normal'})`,
      );

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

    socket.on(OVERLAY_SOCKET_EVENTS.ERROR, (payload: OverlayErrorPayload) => {
      logger.warn(
        `[OVERLAY] Error from ${socket.data.overlayClientLabel || 'unknown-device'} (${socket.data.overlayClientId}) on job ${
          payload?.jobId
        }: ${payload?.code} ${payload?.message}`,
      );
    });

    socket.on(OVERLAY_SOCKET_EVENTS.PLAYBACK_STATE, async (payload: OverlayPlaybackStatePayload) => {
      const playbackJobId = typeof payload?.jobId === 'string' && payload.jobId.trim() ? payload.jobId.trim() : null;
      const playbackState = resolvePlaybackState(payload?.state);
      const remainingMs = resolvePlaybackRemainingMs(payload?.remainingMs);

      logger.debug(
        `[OVERLAY] Playback state received from ${socket.data.overlayClientLabel || 'unknown-device'} (${socket.data.overlayClientId}, guild: ${guildId}, jobId: ${playbackJobId || 'unknown'}, state: ${playbackState}, remainingMs: ${
          remainingMs === null ? 'null' : remainingMs
        })`,
      );

      await playbackScheduler.onPlaybackState({
        guildId,
        jobId: playbackJobId,
        state: playbackState,
        remainingMs,
      });
    });

    socket.on(OVERLAY_SOCKET_EVENTS.STOP, async (payload: OverlayStopPayload) => {
      const stopJobId = typeof payload?.jobId === 'string' && payload.jobId.trim() ? payload.jobId.trim() : 'unknown';

      if (stopJobId === 'manual-stop') {
        await executeManualStopForGuild(fastify, guildId, {
          logLabel: 'Stop command',
        });
      } else {
        await playbackScheduler.onPlaybackStopped({
          guildId,
          jobId: stopJobId,
        });
      }

      logger.info(
        `[OVERLAY] Stop received from ${socket.data.overlayClientLabel || 'unknown-device'} (${socket.data.overlayClientId}, guild: ${guildId}, jobId: ${stopJobId})`,
      );
    });

    socket.on(OVERLAY_SOCKET_EVENTS.MEME_TRIGGER, async (payload: OverlayMemeTriggerPayload) => {
      const rawItemId = typeof payload?.itemId === 'string' ? payload.itemId.trim() : '';
      const triggerKind = payload?.trigger === 'ui' ? 'ui' : 'shortcut';

      if (!rawItemId) {
        logger.warn(
          `[OVERLAY] Meme trigger ignored from ${socket.data.overlayClientLabel || 'unknown-device'} (${socket.data.overlayClientId}, guild: ${guildId}): missing itemId`,
        );
        return;
      }

      const item = await prisma.memeBoardItem.findFirst({
        where: {
          id: rawItemId,
          guildId,
        },
        include: {
          mediaAsset: true,
        },
      });

      if (!item || !item.mediaAsset || item.mediaAsset.status !== MediaAssetStatus.READY) {
        logger.warn(
          `[OVERLAY] Meme trigger ignored from ${socket.data.overlayClientLabel || 'unknown-device'} (${socket.data.overlayClientId}, guild: ${guildId}, itemId: ${rawItemId}): unavailable media`,
        );
        return;
      }

      const itemAuthorName =
        typeof item.createdByName === 'string' && item.createdByName.trim() !== '' ? item.createdByName.trim() : null;
      const itemMessage =
        typeof item.message === 'string' && item.message.trim() !== '' ? item.message.trim().slice(0, 500) : null;
      const triggerAuthorName = toNonEmptyString(socket.data.overlayAuthorName) || itemAuthorName;
      const triggerAuthorImage = toNonEmptyString(socket.data.overlayAuthorImage);

      const job = await createPlaybackJob({
        guildId,
        mediaAsset: item.mediaAsset,
        text: itemMessage,
        showText: !!itemMessage,
        authorName: triggerAuthorName,
        authorImage: triggerAuthorImage,
        priority: MEME_JOB_PRIORITY,
        skipScheduleNotify: true,
        source: `overlay_meme_trigger_${triggerKind}`,
      });

      await playbackScheduler.preemptWithJob({
        guildId,
        preemptingJobId: job.id,
      });

      logger.info(
        `[OVERLAY] Meme trigger accepted from ${socket.data.overlayClientLabel || 'unknown-device'} (${socket.data.overlayClientId}, guild: ${guildId}, itemId: ${rawItemId}, trigger: ${triggerKind}, jobId: ${job.id})`,
      );
    });

    socket.on('disconnecting', () => {
      connectionState.onDisconnecting(socket, guildId);
    });

    socket.on('disconnect', async (reason) => {
      const disconnectReason = typeof reason === 'string' ? reason : String(reason);
      await connectionState.onDisconnected(socket, guildId, disconnectReason);
    });
  };

  return {
    registerHandlers,
  };
};
