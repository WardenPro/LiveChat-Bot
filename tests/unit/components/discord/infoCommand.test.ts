import { describe, expect, it, vi } from 'vitest';

import { infoCommand } from '../../../../src/components/discord/infoCommand';

interface InteractionStub {
  reply: ReturnType<typeof vi.fn>;
}

const createInteraction = (overrides: Partial<InteractionStub> = {}): InteractionStub => {
  return {
    reply: vi.fn(async () => undefined),
    ...overrides,
  };
};

describe('components/discord/infoCommand', () => {
  it('returns bot information with the current year', async () => {
    const interaction = createInteraction();

    await infoCommand().handler(interaction as any);

    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: `LiveChat Bot - ${new Date().getFullYear()}`,
      description: '[GitHub Repository](https://github.com/WardenPro/LiveChat-Bot)',
    });
  });

  it('propagates reply failures when interaction response throws', async () => {
    const expectedError = new Error('reply rejected');
    const interaction = createInteraction({
      reply: vi.fn(async () => {
        throw expectedError;
      }),
    });

    await expect(infoCommand().handler(interaction as any)).rejects.toThrow(expectedError);
  });
});
