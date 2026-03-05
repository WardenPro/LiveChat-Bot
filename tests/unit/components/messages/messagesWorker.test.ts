import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeMessagesWorker } from '../../../../src/components/messages/messagesWorker';
import { buildMediaOverlayTextPayload } from '../../../../src/services/messages/richOverlayPayload';
import { MediaAssetStatus, PlaybackJobStatus } from '../../../../src/services/prisma/prismaEnums';
import { OVERLAY_SOCKET_EVENTS } from '@livechat/overlay-protocol';

const createPendingJob = (overrides: Partial<Record<string, unknown>> = {}) => {
  return {
    id: 'job-1',
    guildId: 'guild-1',
    status: PlaybackJobStatus.PENDING,
    executionDate: new Date('2026-03-05T10:00:05.000Z'),
    submissionDate: new Date('2026-03-05T10:00:00.000Z'),
    mediaAssetId: 'asset-1',
    text: null,
    showText: false,
    authorName: 'Overlay Host',
    authorImage: 'https://cdn.example.com/host.png',
    durationSec: 20,
    ...overrides,
  };
};

const createFastifyHarness = (params?: {
  guildId?: string;
  connectedClients?: number;
}) => {
  const guildId = params?.guildId ?? 'guild-1';
  const connectedClients = params?.connectedClients ?? 0;
  const roomName = `overlay-guild-${guildId}`;
  const rooms = new Map<string, Set<string>>();

  if (connectedClients > 0) {
    const clients = new Set<string>();

    for (let index = 0; index < connectedClients; index += 1) {
      clients.add(`socket-${index}`);
    }

    rooms.set(roomName, clients);
  }

  const emit = vi.fn();
  const to = vi.fn(() => ({
    emit,
  }));

  const fastify = {
    io: {
      sockets: {
        adapter: {
          rooms,
        },
      },
      to,
    },
  };

  return {
    fastify,
    emit,
    to,
  };
};

describe('components/messages/messagesWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T10:00:10.000Z'));

    global.env = {
      API_URL: 'https://api.livechat.test',
    } as any;

    global.logger = {
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    } as any;

    global.prisma = {
      playbackJob: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      guild: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      mediaAsset: {
        findFirst: vi.fn(),
      },
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('builds and emits the overlay play payload with rich media offsets', async () => {
    const nextJob = createPendingJob({
      text: buildMediaOverlayTextPayload({
        text: '  Clip caption  ',
        startOffsetSec: 7.9,
      }),
      showText: true,
    });

    global.prisma.playbackJob.findFirst.mockResolvedValueOnce(nextJob).mockResolvedValueOnce(null);
    global.prisma.guild.findFirst.mockResolvedValue({
      id: 'guild-1',
      busyUntil: null,
    });
    global.prisma.mediaAsset.findFirst.mockResolvedValue({
      id: 'asset-1',
      mime: 'video/mp4',
      kind: 'VIDEO',
      durationSec: 30,
      isVertical: false,
      status: MediaAssetStatus.READY,
    });
    global.prisma.guild.upsert.mockResolvedValue({ id: 'guild-1' });
    global.prisma.playbackJob.update.mockResolvedValue({ id: 'job-1' });

    const { fastify, emit } = createFastifyHarness({
      connectedClients: 2,
    });

    const result = await executeMessagesWorker(fastify as any);

    expect(result).toBe(100);
    expect(global.prisma.playbackJob.update).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
      },
      data: {
        status: PlaybackJobStatus.PLAYING,
        startedAt: expect.any(Date),
      },
    });
    expect(emit).toHaveBeenCalledTimes(1);

    const [eventName, payload] = emit.mock.calls[0] as [string, any];

    expect(eventName).toBe(OVERLAY_SOCKET_EVENTS.PLAY);
    expect(payload).toMatchObject({
      jobId: 'job-1',
      media: {
        assetId: 'asset-1',
        kind: 'video',
        startOffsetSec: 7,
      },
      text: {
        value: 'Clip caption',
        enabled: true,
      },
      author: {
        name: 'Overlay Host',
        image: 'https://cdn.example.com/host.png',
        enabled: true,
      },
      durationSec: 13,
    });
    expect(payload.media.url).toBe('https://api.livechat.test/overlay/media/asset-1?startOffsetSec=7#t=7');
  });

  it('defers scheduling when another playback job is still active', async () => {
    const nextJob = createPendingJob({
      id: 'job-deferred',
      mediaAssetId: null,
      text: 'plain text',
    });

    global.prisma.playbackJob.findFirst
      .mockResolvedValueOnce(nextJob)
      .mockResolvedValueOnce({
        id: 'job-playing',
        startedAt: new Date('2026-03-05T10:00:08.000Z'),
        durationSec: 30,
      });
    global.prisma.guild.findFirst.mockResolvedValue({
      id: 'guild-1',
      busyUntil: new Date('2026-03-05T10:00:14.000Z'),
    });
    global.prisma.playbackJob.update.mockResolvedValue({ id: 'job-deferred' });

    const { fastify, emit, to } = createFastifyHarness({
      connectedClients: 1,
    });

    const result = await executeMessagesWorker(fastify as any);

    expect(result).toBeUndefined();
    expect(global.prisma.playbackJob.update).toHaveBeenCalledTimes(1);

    const updatePayload = global.prisma.playbackJob.update.mock.calls[0][0] as {
      where: { id: string };
      data: { executionDate: Date };
    };

    expect(updatePayload.where.id).toBe('job-deferred');
    expect(updatePayload.data.executionDate).toBeInstanceOf(Date);
    expect(updatePayload.data.executionDate.getTime()).toBeGreaterThan(new Date('2026-03-05T10:00:10.000Z').getTime());
    expect(global.prisma.guild.upsert).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('marks jobs as failed when no overlay client is connected and emits nothing', async () => {
    const nextJob = createPendingJob({
      id: 'job-no-overlay',
      mediaAssetId: null,
      text: 'message without media',
      showText: true,
    });

    global.prisma.playbackJob.findFirst.mockResolvedValueOnce(nextJob).mockResolvedValueOnce(null);
    global.prisma.guild.findFirst.mockResolvedValue(null);
    global.prisma.playbackJob.update.mockResolvedValue({ id: 'job-no-overlay' });

    const { fastify, emit, to } = createFastifyHarness({
      connectedClients: 0,
    });

    const result = await executeMessagesWorker(fastify as any);

    expect(result).toBe(100);
    expect(global.prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
    expect(global.prisma.playbackJob.update).toHaveBeenCalledWith({
      where: {
        id: 'job-no-overlay',
      },
      data: {
        status: PlaybackJobStatus.FAILED,
        finishedAt: expect.any(Date),
      },
    });
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
