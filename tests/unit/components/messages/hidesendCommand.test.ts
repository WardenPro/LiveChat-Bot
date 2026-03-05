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

import { hideSendCommand } from '../../../../src/components/messages/hidesendCommand';

interface InteractionStub {
  guildId: string | null;
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

describe('components/messages/hidesendCommand', () => {
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
          hideSendCommand: 'hide-send',
          hideSendCommandDescription: 'Queue hidden media',
          hideSendCommandOptionURL: 'url',
          hideSendCommandOptionURLDescription: 'Source URL',
          hideSendCommandOptionMedia: 'media',
          hideSendCommandOptionMediaDescription: 'Uploaded media',
          hideSendCommandOptionText: 'text',
          hideSendCommandOptionTextDescription: 'Overlay caption',
          hideSendCommandOptionForceRefresh: 'force-refresh',
          hideSendCommandOptionForceRefreshDescription: 'Bypass cache',
          hideSendCommandAnswer: 'Hidden message queued',
          sendCommandMissingContent: 'Provide a URL, media, or text',
          success: 'Success',
          error: 'Error',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('queues a hidden playback job with encoded media text payload', async () => {
    commandMocks.extractMediaStartOffsetSec.mockReturnValue(9.6);
    commandMocks.ingestMediaFromSource.mockResolvedValue({
      id: 'asset-hidden',
      kind: 'VIDEO',
    });

    const interaction = createInteraction({
      text: '  Secret caption  ',
      attachment: {
        proxyURL: 'https://cdn.example.com/hidden.mp4',
      },
      forceRefresh: false,
    });

    await hideSendCommand().handler(interaction as any);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(commandMocks.createPlaybackJob).toHaveBeenCalledTimes(1);

    const payload = commandMocks.createPlaybackJob.mock.calls[0][0] as {
      guildId: string;
      mediaAsset: { id: string };
      text: string;
      showText: boolean;
      source: string;
      authorName?: string;
      authorImage?: string;
    };

    const decoded = decodeRichOverlayPayload(payload.text);

    expect(payload).toMatchObject({
      guildId: 'guild-1',
      mediaAsset: { id: 'asset-hidden' },
      showText: true,
      source: 'discord_hidesend_command',
    });
    expect(payload.authorName).toBeUndefined();
    expect(payload.authorImage).toBeUndefined();
    expect(decoded).toEqual({
      type: 'media',
      caption: 'Secret caption',
      startOffsetSec: 9,
    });

    const responsePayload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(responsePayload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Hidden message queued',
      color: 0x2ecc71,
    });
  });

  it('returns a refusal response when no URL/media/text is provided', async () => {
    const interaction = createInteraction({
      url: null,
      text: null,
      attachment: null,
    });

    await hideSendCommand().handler(interaction as any);

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
