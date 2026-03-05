import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decodeRichOverlayPayload } from '../../../../src/services/messages/richOverlayPayload';

const commandMocks = vi.hoisted(() => {
  return {
    ingestMediaFromSource: vi.fn(),
    getLocalizedMediaErrorMessage: vi.fn(),
    toMediaIngestionError: vi.fn(),
    extractMediaStartOffsetSec: vi.fn(),
    createPlaybackJob: vi.fn(),
    normalizeTweetStatusUrl: vi.fn(),
    resolveTweetCardFromUrl: vi.fn(),
    resolveTweetCardFromUrlWithOptions: vi.fn(),
    extractTweetStatusIdFromUrl: vi.fn(),
    resolveTweetVideoMediasFromUrl: vi.fn(),
  };
});

vi.mock('../../../../src/services/media/mediaIngestion', () => {
  return {
    ingestMediaFromSource: commandMocks.ingestMediaFromSource,
  };
});

vi.mock('../../../../src/services/media/mediaErrors', () => {
  return {
    getLocalizedMediaErrorMessage: commandMocks.getLocalizedMediaErrorMessage,
    toMediaIngestionError: commandMocks.toMediaIngestionError,
  };
});

vi.mock('../../../../src/services/media/mediaSourceResolver', () => {
  return {
    extractMediaStartOffsetSec: commandMocks.extractMediaStartOffsetSec,
  };
});

vi.mock('../../../../src/services/playbackJobs', () => {
  return {
    createPlaybackJob: commandMocks.createPlaybackJob,
  };
});

vi.mock('../../../../src/services/social/twitterOEmbed', () => {
  return {
    normalizeTweetStatusUrl: commandMocks.normalizeTweetStatusUrl,
    resolveTweetCardFromUrl: commandMocks.resolveTweetCardFromUrl,
    resolveTweetCardFromUrlWithOptions: commandMocks.resolveTweetCardFromUrlWithOptions,
  };
});

vi.mock('../../../../src/services/social/twitterVideoResolver', () => {
  return {
    extractTweetStatusIdFromUrl: commandMocks.extractTweetStatusIdFromUrl,
    resolveTweetVideoMediasFromUrl: commandMocks.resolveTweetVideoMediasFromUrl,
  };
});

import { sendCommand } from '../../../../src/components/messages/sendCommand';

interface InteractionStub {
  guildId: string | null;
  user: {
    username: string;
    avatarURL: ReturnType<typeof vi.fn>;
  };
  options: {
    get: ReturnType<typeof vi.fn>;
  };
  reply: ReturnType<typeof vi.fn>;
  deferReply: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
}

const createInteraction = (params?: {
  url?: string | null;
  text?: string | null;
  attachment?: { url?: string; proxyURL?: string } | null;
  forceRefresh?: boolean;
}): InteractionStub => {
  return {
    guildId: 'guild-1',
    user: {
      username: 'Overlay Host',
      avatarURL: vi.fn(() => 'https://cdn.example.com/host.png'),
    },
    options: {
      get: vi.fn((name: string) => {
        if (name === 'url') {
          return params?.url == null ? undefined : { value: params.url };
        }

        if (name === 'text') {
          return params?.text == null ? undefined : { value: params.text };
        }

        if (name === 'media') {
          return params?.attachment == null ? undefined : { attachment: params.attachment };
        }

        if (name === 'force-refresh') {
          return params?.forceRefresh == null ? undefined : { value: params.forceRefresh };
        }

        return undefined;
      }),
    },
    reply: vi.fn(async () => undefined),
    deferReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
  };
};

describe('components/messages/sendCommand', () => {
  beforeEach(() => {
    commandMocks.ingestMediaFromSource.mockReset();
    commandMocks.getLocalizedMediaErrorMessage.mockReset();
    commandMocks.toMediaIngestionError.mockReset();
    commandMocks.extractMediaStartOffsetSec.mockReset();
    commandMocks.createPlaybackJob.mockReset();
    commandMocks.normalizeTweetStatusUrl.mockReset();
    commandMocks.resolveTweetCardFromUrl.mockReset();
    commandMocks.resolveTweetCardFromUrlWithOptions.mockReset();
    commandMocks.extractTweetStatusIdFromUrl.mockReset();
    commandMocks.resolveTweetVideoMediasFromUrl.mockReset();

    global.logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as any;

    global.rosetty = {
      t: vi.fn((key: string) => {
        const translationMap: Record<string, string> = {
          sendCommand: 'send',
          sendCommandDescription: 'Send media or text',
          sendCommandOptionURL: 'url',
          sendCommandOptionURLDescription: 'Source URL',
          sendCommandOptionMedia: 'media',
          sendCommandOptionMediaDescription: 'Uploaded media',
          sendCommandOptionText: 'text',
          sendCommandOptionTextDescription: 'Overlay text',
          sendCommandOptionForceRefresh: 'force-refresh',
          sendCommandOptionForceRefreshDescription: 'Bypass cache',
          sendCommandMissingContent: 'Provide a URL, media, or text',
          sendCommandAnswer: 'Message sent',
          success: 'Success',
          error: 'Error',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('builds the expected playback payload and enqueues exactly one worker job', async () => {
    commandMocks.extractMediaStartOffsetSec.mockReturnValue(12.8);
    commandMocks.ingestMediaFromSource.mockResolvedValue({
      id: 'asset-1',
      kind: 'VIDEO',
    });

    const interaction = createInteraction({
      text: '  Hello overlay  ',
      attachment: {
        url: 'https://cdn.example.com/clip.mp4',
      },
      forceRefresh: true,
    });

    await sendCommand().handler(interaction as any);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(commandMocks.ingestMediaFromSource).toHaveBeenCalledWith({
      url: undefined,
      media: 'https://cdn.example.com/clip.mp4',
      forceRefresh: true,
    });
    expect(commandMocks.createPlaybackJob).toHaveBeenCalledTimes(1);

    const payload = commandMocks.createPlaybackJob.mock.calls[0][0] as {
      guildId: string;
      mediaAsset: { id: string };
      text: string;
      showText: boolean;
      authorName: string;
      authorImage: string | null;
      source: string;
    };

    const decoded = decodeRichOverlayPayload(payload.text);

    expect(payload).toMatchObject({
      guildId: 'guild-1',
      mediaAsset: { id: 'asset-1' },
      showText: true,
      authorName: 'Overlay Host',
      authorImage: 'https://cdn.example.com/host.png',
      source: 'discord_send_command',
    });
    expect(decoded).toEqual({
      type: 'media',
      caption: 'Hello overlay',
      startOffsetSec: 12,
    });

    const responsePayload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(responsePayload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Message sent',
      color: 0x2ecc71,
    });
  });

  it('refuses empty content and does not trigger outbound playback side effects', async () => {
    const interaction = createInteraction({
      url: null,
      text: null,
      attachment: null,
    });

    await sendCommand().handler(interaction as any);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(commandMocks.ingestMediaFromSource).not.toHaveBeenCalled();
    expect(commandMocks.createPlaybackJob).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Error',
      description: 'Provide a URL, media, or text',
      color: 0xe74c3c,
    });
  });
});
