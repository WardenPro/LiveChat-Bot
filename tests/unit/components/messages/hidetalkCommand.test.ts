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

import { hideTalkCommand } from '../../../../src/components/messages/hidetalkCommand';

interface InteractionStub {
  guildId: string | null;
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

describe('components/messages/hidetalkCommand', () => {
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
          hideTalkCommand: 'hide-talk',
          hideTalkCommandDescription: 'Create hidden spoken message',
          hideTalkCommandOptionVoice: 'voice',
          hideTalkCommandOptionVoiceDescription: 'Voice preset',
          hideTalkCommandOptionText: 'text',
          hideTalkCommandOptionTextDescription: 'Speech text',
          hideTalkCommandAnswer: 'Hidden speech queued',
          talkCommandVoiceError: 'Voice generation failed',
          success: 'Success',
          error: 'Error',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('queues one hidden talk playback job with the expected payload', async () => {
    commandMocks.promisedGtts.mockResolvedValue('/tmp/hidetalk-voice.mp3');
    commandMocks.ingestMediaFromLocalFile.mockResolvedValue({
      id: 'media-hidden-voice',
      kind: 'AUDIO',
    });

    const interaction = createInteraction({
      voice: 'fr-FR-Wavenet-A',
      text: 'Message secret',
    });

    await hideTalkCommand().handler(interaction as any);

    const sourceHash = crypto.createHash('sha1').update('fr:fr-FR-Wavenet-A').digest('hex');

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(commandMocks.promisedGtts).toHaveBeenCalledWith('fr-FR-Wavenet-A', 'fr');
    expect(commandMocks.ingestMediaFromLocalFile).toHaveBeenCalledWith(
      '/tmp/hidetalk-voice.mp3',
      `gtts:fr:${sourceHash}`,
    );
    expect(commandMocks.createPlaybackJob).toHaveBeenCalledTimes(1);
    expect(commandMocks.createPlaybackJob).toHaveBeenCalledWith({
      guildId: 'guild-1',
      mediaAsset: {
        id: 'media-hidden-voice',
        kind: 'AUDIO',
      },
      text: 'Message secret',
      showText: true,
      source: 'discord_hidetalk_command',
    });
    expect(commandMocks.deleteGtts).toHaveBeenCalledWith('/tmp/hidetalk-voice.mp3');

    const responsePayload = interaction.editReply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
    };

    expect(responsePayload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Hidden speech queued',
      color: 0x2ecc71,
    });
  });

  it('returns the translated voice-generation error and avoids outbound effects on failure', async () => {
    const generationError = new Error('gtts failure');
    commandMocks.promisedGtts.mockRejectedValue(generationError);

    const interaction = createInteraction({
      voice: 'fr-FR-Wavenet-A',
      text: 'Message secret',
    });

    await hideTalkCommand().handler(interaction as any);

    expect(commandMocks.ingestMediaFromLocalFile).not.toHaveBeenCalled();
    expect(commandMocks.createPlaybackJob).not.toHaveBeenCalled();
    expect(commandMocks.deleteGtts).not.toHaveBeenCalled();
    expect(commandMocks.getLocalizedMediaErrorMessage).not.toHaveBeenCalled();
    expect(global.logger.error).toHaveBeenCalledWith(generationError, '[MEDIA] hide talk command failed (voice generation)');

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
