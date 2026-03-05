import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandMocks = vi.hoisted(() => {
  return {
    executeManualStopForGuild: vi.fn(),
  };
});

vi.mock('../../../../src/services/manualStop', () => {
  return {
    executeManualStopForGuild: commandMocks.executeManualStopForGuild,
  };
});

import { stopCommand } from '../../../../src/components/messages/stopCommand';

interface InteractionStub {
  guildId: string | null;
  reply: ReturnType<typeof vi.fn>;
}

const createInteraction = (params?: { guildId?: string | null }): InteractionStub => {
  return {
    guildId: params?.guildId === undefined ? 'guild-1' : params.guildId,
    reply: vi.fn(async () => undefined),
  };
};

describe('components/messages/stopCommand', () => {
  beforeEach(() => {
    commandMocks.executeManualStopForGuild.mockReset();

    global.rosetty = {
      t: vi.fn((key: string) => {
        const translationMap: Record<string, string> = {
          stopCommand: 'stop',
          stopCommandDescription: 'Stop playback',
          stopCommandAnswer: 'Playback stopped',
          success: 'Success',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('delegates to manual stop and replies with the success embed', async () => {
    commandMocks.executeManualStopForGuild.mockResolvedValue({
      releasedCount: 1,
      hasPlayingJob: false,
      hasBusyLock: false,
    });

    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const interaction = createInteraction();

    await stopCommand(fastify).handler(interaction as any);

    expect(commandMocks.executeManualStopForGuild).toHaveBeenCalledWith(fastify, 'guild-1', {
      logLabel: 'Stop command',
    });
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Playback stopped',
      color: 0x2ecc71,
    });
  });

  it('propagates manual-stop failures and avoids sending a success reply', async () => {
    const stopError = new Error('stop failed');
    commandMocks.executeManualStopForGuild.mockRejectedValue(stopError);

    const fastify = {
      io: {},
    } as FastifyCustomInstance;
    const interaction = createInteraction();

    await expect(stopCommand(fastify).handler(interaction as any)).rejects.toThrow(stopError);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
