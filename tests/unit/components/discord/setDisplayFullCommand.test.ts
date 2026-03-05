import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDisplayMediaFullCommand } from '../../../../src/components/discord/setDisplayFullCommand';

interface InteractionStub {
  guildId: string;
  user: {
    id: string;
  };
  options: {
    get: ReturnType<typeof vi.fn>;
  };
  reply: ReturnType<typeof vi.fn>;
}

interface DiscordClientStub {
  guilds: {
    fetch: ReturnType<typeof vi.fn>;
  };
}

const createInteraction = (displayFullValue: unknown): InteractionStub => {
  return {
    guildId: 'guild-1',
    user: {
      id: 'user-1',
    },
    options: {
      get: vi.fn((name: string) => {
        if (name === 'display-full') {
          return {
            value: displayFullValue,
          };
        }

        return undefined;
      }),
    },
    reply: vi.fn(async () => undefined),
  };
};

const createDiscordClient = (isAdmin: boolean): DiscordClientStub => {
  const guildMember = {
    permissions: {
      has: vi.fn(() => isAdmin),
    },
  };

  return {
    guilds: {
      fetch: vi.fn(async () => {
        return {
          members: {
            fetch: vi.fn(async () => guildMember),
          },
        };
      }),
    },
  };
};

describe('components/discord/setDisplayFullCommand', () => {
  beforeEach(() => {
    global.prisma = {
      guild: {
        upsert: vi.fn(async () => undefined),
      },
    } as any;

    global.rosetty = {
      t: vi.fn((key: string) => {
        const translationMap: Record<string, string> = {
          setDisplayMediaFullCommand: 'set-display-media-full',
          setDisplayMediaFullCommandDescription: 'Set display-full flag',
          setDisplayMediaFullCommandOptionText: 'display-full',
          setDisplayMediaFullCommandOptionTextDescription: 'Display media full size',
          notAllowed: 'Not allowed',
          success: 'Success',
          setDisplayMediaFullCommandAnswer: 'Display mode updated',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('upserts displayMediaFull for administrators', async () => {
    const interaction = createInteraction(true);
    const discordClient = createDiscordClient(true);

    await setDisplayMediaFullCommand().handler(interaction as any, discordClient as any);

    expect(global.prisma.guild.upsert).toHaveBeenCalledWith({
      where: {
        id: 'guild-1',
      },
      create: {
        id: 'guild-1',
        displayMediaFull: true,
      },
      update: {
        displayMediaFull: true,
      },
    });

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Display mode updated',
      color: 0x2ecc71,
    });
  });

  it('returns not-allowed for non-administrator users', async () => {
    const interaction = createInteraction(false);
    const discordClient = createDiscordClient(false);

    await setDisplayMediaFullCommand().handler(interaction as any, discordClient as any);

    expect(global.prisma.guild.upsert).not.toHaveBeenCalled();

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Not allowed',
      color: 0xe74c3c,
    });
  });
});
