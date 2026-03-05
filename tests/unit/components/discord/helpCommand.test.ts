import { describe, expect, it, vi } from 'vitest';

import { helpCommand } from '../../../../src/components/discord/helpCommand';

interface InteractionStub {
  reply: ReturnType<typeof vi.fn>;
}

const createInteraction = (overrides: Partial<InteractionStub> = {}): InteractionStub => {
  return {
    reply: vi.fn(async () => undefined),
    ...overrides,
  };
};

describe('components/discord/helpCommand', () => {
  it('returns the loaded command list in an ephemeral embed', async () => {
    global.commandsLoaded = ['alive', 'help', 'overlays'];

    const interaction = createInteraction();
    await helpCommand().handler(interaction as any);

    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Commands :',
      description: '`/alive`, `/help`, `/overlays`',
    });
  });

  it('propagates reply failures when Discord rejects the response', async () => {
    const expectedError = new Error('cannot reply');
    const interaction = createInteraction({
      reply: vi.fn(async () => {
        throw expectedError;
      }),
    });

    await expect(helpCommand().handler(interaction as any)).rejects.toThrow(expectedError);
  });
});
