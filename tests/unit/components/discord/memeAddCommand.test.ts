import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaCommandMocks = vi.hoisted(() => {
  return {
    ingestMediaFromSource: vi.fn(),
    addToMemeBoard: vi.fn(),
    getLocalizedMediaErrorMessage: vi.fn(),
    toMediaIngestionError: vi.fn(),
  };
});

vi.mock('../../../../src/services/media/mediaIngestion', () => {
  return {
    ingestMediaFromSource: mediaCommandMocks.ingestMediaFromSource,
  };
});

vi.mock('../../../../src/services/memeBoard', () => {
  return {
    addToMemeBoard: mediaCommandMocks.addToMemeBoard,
  };
});

vi.mock('../../../../src/services/media/mediaErrors', () => {
  return {
    getLocalizedMediaErrorMessage: mediaCommandMocks.getLocalizedMediaErrorMessage,
    toMediaIngestionError: mediaCommandMocks.toMediaIngestionError,
  };
});

import { memeAddCommand } from '../../../../src/components/discord/memeAddCommand';

interface InteractionStub {
  guildId: string | null;
  user: {
    id: string;
    username: string;
    globalName: string | null;
  };
  member: {
    nick?: unknown;
  };
  options: {
    get: ReturnType<typeof vi.fn>;
  };
  reply: ReturnType<typeof vi.fn>;
  deferReply: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
}

const createInteraction = (params?: {
  guildId?: string | null;
  url?: string | null;
  title?: string | null;
  attachment?: { url?: string; proxyURL?: string } | null;
  forceRefresh?: boolean;
  memberNick?: unknown;
  globalName?: string | null;
}): InteractionStub => {
  const url = params?.url;
  const title = params?.title;
  const attachment = params?.attachment;
  const forceRefresh = params?.forceRefresh;

  return {
    guildId: params?.guildId === undefined ? 'guild-1' : params.guildId,
    user: {
      id: 'user-1',
      username: 'fallback-user',
      globalName: params?.globalName ?? 'Global User',
    },
    member: {
      nick: params?.memberNick ?? 'Meme Author',
    },
    options: {
      get: vi.fn((name: string) => {
        if (name === 'url') {
          return url == null ? undefined : { value: url };
        }

        if (name === 'title') {
          return title == null ? undefined : { value: title };
        }

        if (name === 'media') {
          return attachment == null ? undefined : { attachment };
        }

        if (name === 'force-refresh') {
          return forceRefresh == null ? undefined : { value: forceRefresh };
        }

        return undefined;
      }),
    },
    reply: vi.fn(async () => undefined),
    deferReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
  };
};

describe('components/discord/memeAddCommand', () => {
  beforeEach(() => {
    mediaCommandMocks.ingestMediaFromSource.mockReset();
    mediaCommandMocks.addToMemeBoard.mockReset();
    mediaCommandMocks.getLocalizedMediaErrorMessage.mockReset();
    mediaCommandMocks.toMediaIngestionError.mockReset();

    global.logger = {
      error: vi.fn(),
    } as any;

    global.rosetty = {
      t: vi.fn((key: string) => {
        const translationMap: Record<string, string> = {
          memeAddCommand: 'meme-add',
          memeAddCommandDescription: 'Add media to meme board',
          memeAddCommandOptionURL: 'url',
          memeAddCommandOptionURLDescription: 'Media URL',
          memeAddCommandOptionMedia: 'media',
          memeAddCommandOptionMediaDescription: 'Uploaded media',
          memeAddCommandOptionTitle: 'title',
          memeAddCommandOptionTitleDescription: 'Meme title',
          memeAddCommandOptionForceRefresh: 'force-refresh',
          memeAddCommandOptionForceRefreshDescription: 'Bypass cache',
          memeAddCommandMissingMedia: 'Provide a URL or an attachment',
          memeAddCommandAnswerCreated: 'Meme added',
          memeAddCommandAnswerExists: 'Meme already exists',
          error: 'Error',
          notAllowed: 'Not allowed',
          success: 'Success',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('ingests media and replies with a success embed when creation succeeds', async () => {
    mediaCommandMocks.ingestMediaFromSource.mockResolvedValue({
      id: 'asset-1',
    });
    mediaCommandMocks.addToMemeBoard.mockResolvedValue({
      created: true,
    });

    const interaction = createInteraction({
      url: 'https://cdn.example.com/media.mp4',
      title: 'Best meme',
      forceRefresh: true,
    });

    await memeAddCommand().handler(interaction as any);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mediaCommandMocks.ingestMediaFromSource).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/media.mp4',
      media: undefined,
      forceRefresh: true,
    });
    expect(mediaCommandMocks.addToMemeBoard).toHaveBeenCalledWith({
      guildId: 'guild-1',
      mediaAssetId: 'asset-1',
      title: 'Best meme',
      createdByDiscordUserId: 'user-1',
      createdByName: 'Meme Author',
    });

    const payload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Meme added',
      color: 0x2ecc71,
    });
  });

  it('returns an error payload when neither URL nor attachment is provided', async () => {
    const interaction = createInteraction({
      url: null,
      attachment: null,
    });

    await memeAddCommand().handler(interaction as any);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mediaCommandMocks.ingestMediaFromSource).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Error',
      description: 'Provide a URL or an attachment',
      color: 0xe74c3c,
    });
  });

  it('returns not allowed when guild context is missing', async () => {
    const interaction = createInteraction({
      guildId: null,
      url: 'https://cdn.example.com/media.mp4',
    });

    await memeAddCommand().handler(interaction as any);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mediaCommandMocks.ingestMediaFromSource).not.toHaveBeenCalled();

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Error',
      description: 'Not allowed',
      color: 0xe74c3c,
    });
  });

  it('maps ingestion failures to localized error replies', async () => {
    const rawFailure = new Error('ingestion failed');
    const normalizedFailure = {
      code: 'DOWNLOAD_FAILED',
      message: 'download failed',
    };

    mediaCommandMocks.ingestMediaFromSource.mockRejectedValue(rawFailure);
    mediaCommandMocks.toMediaIngestionError.mockReturnValue(normalizedFailure);
    mediaCommandMocks.getLocalizedMediaErrorMessage.mockReturnValue('Localized media failure');

    const interaction = createInteraction({
      attachment: {
        url: 'https://cdn.example.com/upload.png',
      },
      memberNick: '   ',
      globalName: 'Display Name',
    });

    await memeAddCommand().handler(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mediaCommandMocks.toMediaIngestionError).toHaveBeenCalledWith(rawFailure);
    expect(mediaCommandMocks.getLocalizedMediaErrorMessage).toHaveBeenCalledWith(normalizedFailure);
    expect(global.logger.error).toHaveBeenCalledWith(
      {
        err: normalizedFailure,
        sourceUrl: null,
        sourceMedia: 'https://cdn.example.com/upload.png',
      },
      '[MEDIA] meme-add command failed (DOWNLOAD_FAILED)',
    );

    const payload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Error',
      description: 'Localized media failure',
      color: 0xe74c3c,
    });
  });
});
