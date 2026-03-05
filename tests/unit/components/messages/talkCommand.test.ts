import crypto from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandMocks = vi.hoisted(() => {
  return {
    promisedGtts: vi.fn(),
    deleteGtts: vi.fn(),
    ingestMediaFromLocalFile: vi.fn(),
    getLocalizedMediaErrorMessage: vi.fn(),
    toMediaIngestionError: vi.fn(),
    createPlaybackJob: vi.fn(),
  };
});

vi.mock('../../../../src/services/gtts', () => {
  return {
    promisedGtts: commandMocks.promisedGtts,
    deleteGtts: commandMocks.deleteGtts,
  };
});

vi.mock('../../../../src/services/media/mediaIngestion', () => {
  return {
    ingestMediaFromLocalFile: commandMocks.ingestMediaFromLocalFile,
  };
});

vi.mock('../../../../src/services/media/mediaErrors', () => {
  return {
    getLocalizedMediaErrorMessage: commandMocks.getLocalizedMediaErrorMessage,
    toMediaIngestionError: commandMocks.toMediaIngestionError,
  };
});

vi.mock('../../../../src/services/playbackJobs', () => {
  return {
    createPlaybackJob: commandMocks.createPlaybackJob,
  };
});

import { talkCommand } from '../../../../src/components/messages/talkCommand';

interface InteractionStub {
  guildId: string | null;
  user: {
    username: string;
    avatarURL: ReturnType<typeof vi.fn>;
  };
  options: {
    get: ReturnType<typeof vi.fn>;
  };
  deferReply: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
}

const createInteraction = (params?: {
  voice?: string;
  text?: string | null;
}): InteractionStub => {
  return {
    guildId: 'guild-1',
    user: {
      username: 'Narrator',
      avatarURL: vi.fn(() => 'https://cdn.example.com/narrator.png'),
    },
    options: {
      get: vi.fn((name: string) => {
        if (name === 'voice') {
          return { value: params?.voice ?? 'fr-FR-Wavenet-A' };
        }

        if (name === 'text') {
          return params?.text == null ? undefined : { value: params.text };
        }

        return undefined;
      }),
    },
    deferReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
  };
};

describe('components/messages/talkCommand', () => {
  beforeEach(() => {
    commandMocks.promisedGtts.mockReset();
    commandMocks.deleteGtts.mockReset();
    commandMocks.ingestMediaFromLocalFile.mockReset();
    commandMocks.getLocalizedMediaErrorMessage.mockReset();
    commandMocks.toMediaIngestionError.mockReset();
    commandMocks.createPlaybackJob.mockReset();
    commandMocks.deleteGtts.mockResolvedValue(undefined);

    global.logger = {
      error: vi.fn(),
    } as any;

    global.rosetty = {
      getCurrentLang: vi.fn(() => 'fr'),
      t: vi.fn((key: string) => {
        const translationMap: Record<string, string> = {
          talkCommand: 'talk',
          talkCommandDescription: 'Create a spoken overlay message',
          talkCommandOptionVoice: 'voice',
          talkCommandOptionVoiceDescription: 'Voice preset',
          talkCommandOptionText: 'text',
          talkCommandOptionTextDescription: 'Speech text',
          talkCommandAnswer: 'Speech queued',
          talkCommandVoiceError: 'Voice generation failed',
          success: 'Success',
          error: 'Error',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('builds the expected talk worker payload and queues it once', async () => {
    commandMocks.promisedGtts.mockResolvedValue('/tmp/talk-voice.mp3');
    commandMocks.ingestMediaFromLocalFile.mockResolvedValue({
      id: 'media-voice-1',
      kind: 'AUDIO',
    });

    const interaction = createInteraction({
      voice: 'fr-FR-Wavenet-A',
      text: 'Bonjour tout le monde',
    });

    await talkCommand().handler(interaction as any);

    const sourceHash = crypto.createHash('sha1').update('fr:fr-FR-Wavenet-A').digest('hex');

    expect(commandMocks.promisedGtts).toHaveBeenCalledWith('fr-FR-Wavenet-A', 'fr');
    expect(commandMocks.ingestMediaFromLocalFile).toHaveBeenCalledWith('/tmp/talk-voice.mp3', `gtts:fr:${sourceHash}`);
    expect(commandMocks.createPlaybackJob).toHaveBeenCalledTimes(1);
    expect(commandMocks.createPlaybackJob).toHaveBeenCalledWith({
      guildId: 'guild-1',
      mediaAsset: {
        id: 'media-voice-1',
        kind: 'AUDIO',
      },
      text: 'Bonjour tout le monde',
      showText: true,
      authorName: 'Narrator',
      authorImage: 'https://cdn.example.com/narrator.png',
      source: 'discord_talk_command',
    });
    expect(commandMocks.deleteGtts).toHaveBeenCalledWith('/tmp/talk-voice.mp3');

    const responsePayload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(responsePayload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Speech queued',
      color: 0x2ecc71,
    });
  });

  it('uses the translated voice-error path and performs no outbound job when generation fails', async () => {
    const generationError = new Error('gtts failure');
    commandMocks.promisedGtts.mockRejectedValue(generationError);

    const interaction = createInteraction({
      voice: 'fr-FR-Wavenet-A',
      text: 'Bonjour',
    });

    await talkCommand().handler(interaction as any);

    expect(commandMocks.ingestMediaFromLocalFile).not.toHaveBeenCalled();
    expect(commandMocks.createPlaybackJob).not.toHaveBeenCalled();
    expect(commandMocks.deleteGtts).not.toHaveBeenCalled();
    expect(commandMocks.getLocalizedMediaErrorMessage).not.toHaveBeenCalled();
    expect(global.logger.error).toHaveBeenCalledWith(generationError, '[MEDIA] talk command failed (voice generation)');

    const responsePayload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(responsePayload.embeds[0].toJSON()).toMatchObject({
      title: 'Error',
      description: 'Voice generation failed',
      color: 0xe74c3c,
    });
  });
});
