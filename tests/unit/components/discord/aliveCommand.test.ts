import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aliveCommand } from '../../../../src/components/discord/aliveCommand';

interface InteractionStub {
  user: {
    username: string;
  };
  reply: ReturnType<typeof vi.fn>;
}

const createInteraction = (overrides: Partial<InteractionStub> = {}): InteractionStub => {
  return {
    user: {
      username: 'john doe',
    },
    reply: vi.fn(async () => undefined),
    ...overrides,
  };
};

describe('components/discord/aliveCommand', () => {
  beforeEach(() => {
    global.rosetty = {
      t: vi.fn((key: string, values?: Record<string, unknown>) => {
        if (key === 'aliveCommand') {
          return 'alive';
        }

        if (key === 'aliveCommandDescription') {
          return 'Check bot status';
        }

        if (key === 'aliveCommandsAnswer') {
          return `Bot is alive for ${String(values?.username ?? '')}`;
        }

        return key;
      }),
    } as any;
  });

  it('replies with the localized alive embed payload', async () => {
    const command = aliveCommand();
    const interaction = createInteraction();

    await command.handler(interaction as any);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { description?: string; color?: number } }>;
    };

    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      description: 'Bot is alive for John Doe',
      color: 0x2ecc71,
    });
  });

  it('propagates reply failures so Discord loader error mapping can handle them', async () => {
    const expectedError = new Error('reply failed');
    const interaction = createInteraction({
      reply: vi.fn(async () => {
        throw expectedError;
      }),
    });

    await expect(aliveCommand().handler(interaction as any)).rejects.toThrow(expectedError);
  });
});
