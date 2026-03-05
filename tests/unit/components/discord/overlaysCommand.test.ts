import { beforeEach, describe, expect, it, vi } from 'vitest';

import { overlaysCommand } from '../../../../src/components/discord/overlaysCommand';

interface SocketStub {
  data?: {
    overlayAuthorName?: unknown;
    overlayClientLabel?: unknown;
    overlayClientId?: unknown;
  };
}

interface FastifyIoRoomStub {
  fetchSockets: ReturnType<typeof vi.fn>;
}

interface FastifyStub {
  io: {
    in: ReturnType<typeof vi.fn>;
  };
}

interface InteractionStub {
  guildId: string | null;
  reply: ReturnType<typeof vi.fn>;
}

const createFastify = (sockets: SocketStub[]): FastifyStub => {
  const room: FastifyIoRoomStub = {
    fetchSockets: vi.fn(async () => sockets),
  };

  return {
    io: {
      in: vi.fn(() => room),
    },
  };
};

const createInteraction = (overrides: Partial<InteractionStub> = {}): InteractionStub => {
  return {
    guildId: 'guild-1',
    reply: vi.fn(async () => undefined),
    ...overrides,
  };
};

describe('components/discord/overlaysCommand', () => {
  beforeEach(() => {
    global.rosetty = {
      t: vi.fn((key: string, values?: Record<string, unknown>) => {
        if (key === 'overlaysCommand') {
          return 'overlays';
        }

        if (key === 'overlaysCommandDescription') {
          return 'List connected overlays';
        }

        if (key === 'overlaysCommandAnswerTitle') {
          return `Connected overlays (${String(values?.count ?? '?')})`;
        }

        if (key === 'overlaysCommandAnswerEmpty') {
          return 'No overlay connected';
        }

        if (key === 'error') {
          return 'Error';
        }

        if (key === 'notAllowed') {
          return 'Not allowed';
        }

        return key;
      }),
    } as any;
  });

  it('returns an unauthorized reply when the command is not in a guild', async () => {
    const fastify = createFastify([]);
    const interaction = createInteraction({ guildId: null });

    await overlaysCommand(fastify as any).handler(interaction as any);

    expect(fastify.io.in).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Error',
      description: 'Not allowed',
      color: 0xe74c3c,
    });
  });

  it('returns an empty-state payload when no overlay sockets are connected', async () => {
    const fastify = createFastify([]);
    const interaction = createInteraction();

    await overlaysCommand(fastify as any).handler(interaction as any);

    expect(fastify.io.in).toHaveBeenCalledWith('overlay-guild-guild-1');
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds[0].toJSON()).toMatchObject({
      title: 'Connected overlays (0)',
      description: 'No overlay connected',
      color: 0xf1c40f,
    });
  });

  it('returns connected overlay labels sorted and normalized', async () => {
    const fastify = createFastify([
      {
        data: {
          overlayAuthorName: ' Zed ',
          overlayClientId: 'client-z',
        },
      },
      {
        data: {
          overlayClientLabel: 'alpha screen',
          overlayClientId: 'client-a',
        },
      },
      {
        data: {},
      },
    ]);

    const interaction = createInteraction();

    await overlaysCommand(fastify as any).handler(interaction as any);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('Connected overlays (3)');
    expect(embed.color).toBe(0x2ecc71);
    expect(embed.description).toContain('`alpha screen` (`client-a`)');
    expect(embed.description).toContain('`unknown-device` (`unknown-client`)');
    expect(embed.description).toContain('`Zed` (`client-z`)');

    const lines = (embed.description || '').split('\n');
    expect(lines[0]).toContain('alpha screen');
    expect(lines[1]).toContain('unknown-device');
    expect(lines[2]).toContain('Zed');
  });
});
