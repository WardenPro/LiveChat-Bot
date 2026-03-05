import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDefaultTimeCommand } from '../../../../src/components/discord/setDefaultTimeCommand';

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

const createInteraction = (timeValue: unknown): InteractionStub => {
  return {
    guildId: 'guild-1',
    user: {
      id: 'user-1',
    },
    options: {
      get: vi.fn((name: string) => {
        if (name === 'default-time') {
          return {
            value: timeValue,
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

describe('components/discord/setDefaultTimeCommand', () => {
  beforeEach(() => {
    global.prisma = {
      guild: {
        upsert: vi.fn(async () => undefined),
      },
    } as any;

    global.rosetty = {
      t: vi.fn((key: string) => {
        const translationMap: Record<string, string> = {
          setDefaultTimeCommand: 'set-default-time',
          setDefaultTimeCommandDescription: 'Set default media time',
          setDefaultTimeCommandOptionText: 'default-time',
          setDefaultTimeCommandOptionTextDescription: 'Time in seconds',
          notAllowed: 'Not allowed',
          success: 'Success',
          setDefaultTimeCommandAnswer: 'Default media time updated',
        };

        return translationMap[key] ?? key;
      }),
    } as any;
  });

  it('upserts default media time for administrators', async () => {
    const interaction = createInteraction(45);
    const discordClient = createDiscordClient(true);

    await setDefaultTimeCommand().handler(interaction as any, discordClient as any);

    expect(global.prisma.guild.upsert).toHaveBeenCalledWith({
      where: {
        id: 'guild-1',
      },
      create: {
        id: 'guild-1',
        defaultMediaTime: 45,
      },
      update: {
        defaultMediaTime: 45,
      },
    });

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Success',
      description: 'Default media time updated',
      color: 0x2ecc71,
    });
  });

  it('returns not-allowed when the caller is not an administrator', async () => {
    const interaction = createInteraction(90);
    const discordClient = createDiscordClient(false);

    await setDefaultTimeCommand().handler(interaction as any, discordClient as any);

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

  it('normalizes falsy time values to null before persistence', async () => {
    const interaction = createInteraction(0);
    const discordClient = createDiscordClient(true);

    await setDefaultTimeCommand().handler(interaction as any, discordClient as any);

    expect(global.prisma.guild.upsert).toHaveBeenCalledWith({
      where: {
        id: 'guild-1',
      },
      create: {
        id: 'guild-1',
        defaultMediaTime: null,
      },
      update: {
        defaultMediaTime: null,
      },
    });
  });
});
