import crypto from 'crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { overlayCodeCommand } from '../../../../src/components/discord/clientCommand';

interface InteractionStub {
  guildId: string;
  user: {
    id: string;
    username: string;
    globalName: string | null;
    displayAvatarURL: ReturnType<typeof vi.fn>;
  };
  member: {
    nick?: unknown;
    avatar?: unknown;
  };
  options: {
    get: ReturnType<typeof vi.fn>;
  };
  reply: ReturnType<typeof vi.fn>;
}

const createInteraction = (params?: { mode?: string; memberNick?: unknown; memberAvatar?: unknown; globalName?: string | null }): InteractionStub => {
  const mode = params?.mode;

  return {
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: 'test-user',
      globalName: params?.globalName ?? 'Global Name',
      displayAvatarURL: vi.fn(() => 'https://cdn.discordapp.com/users/default.png'),
    },
    member: {
      nick: params?.memberNick === undefined ? 'Nick Name' : params.memberNick,
      avatar: params?.memberAvatar === undefined ? 'avatarhash' : params.memberAvatar,
    },
    options: {
      get: vi.fn((name: string) => {
        if (name === 'mode' && mode !== undefined) {
          return {
            value: mode,
          };
        }

        return undefined;
      }),
    },
    reply: vi.fn(async () => undefined),
  };
};

describe('components/discord/clientCommand', () => {
  beforeEach(() => {
    global.env = {
      PAIRING_CODE_TTL_MINUTES: 20,
      API_URL: 'https://api.livechat.test',
    } as any;

    global.prisma = {
      pairingCode: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => undefined),
      },
    } as any;

    global.rosetty = {
      t: vi.fn((key: string, values?: Record<string, unknown>) => {
        if (key === 'overlayCodeCommand') {
          return 'overlay-code';
        }

        if (key === 'overlayCodeCommandDescription') {
          return 'Create a pairing code';
        }

        if (key === 'overlayCodeCommandOptionMode') {
          return 'mode';
        }

        if (key === 'overlayCodeCommandOptionModeDescription') {
          return 'Pairing mode';
        }

        if (key === 'overlayCodeCommandOptionModeChoiceNormal') {
          return 'Normal';
        }

        if (key === 'overlayCodeCommandOptionModeChoiceInvite') {
          return 'Invite';
        }

        if (key === 'overlayCodeCommandAnswerTitle') {
          return 'Pairing code ready';
        }

        if (key === 'overlayCodeCommandAnswerDescription') {
          return `code=${String(values?.code ?? '')};ttl=${String(values?.expiresIn ?? '')};api=${String(values?.apiUrl ?? '')}`;
        }

        if (key === 'overlayCodeCommandAnswerDescriptionInvite') {
          return `invite=${String(values?.code ?? '')};api=${String(values?.apiUrl ?? '')}`;
        }

        return key;
      }),
    } as any;
  });

  it('creates a normal pairing code and replies with the normal mode payload', async () => {
    const randomBytesSpy = vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.alloc(6, 0));
    const interaction = createInteraction();

    try {
      await overlayCodeCommand().handler(interaction as any);
    } finally {
      randomBytesSpy.mockRestore();
    }

    expect(global.prisma.pairingCode.findUnique).toHaveBeenCalledWith({
      where: {
        code: 'AAAAAA',
      },
    });

    expect(global.prisma.pairingCode.create).toHaveBeenCalledTimes(1);

    const createdPayload = global.prisma.pairingCode.create.mock.calls[0][0] as {
      data: {
        code: string;
        guildId: string;
        mode: string;
        createdByDiscordUserId: string;
        authorName: string;
        authorImage: string;
        expiresAt: Date | null;
      };
    };

    expect(createdPayload.data).toMatchObject({
      code: 'AAAAAA',
      guildId: 'guild-1',
      mode: 'NORMAL',
      createdByDiscordUserId: 'user-1',
      authorName: 'Nick Name',
      authorImage: 'https://cdn.discordapp.com/guilds/guild-1/users/user-1/avatars/avatarhash.png?size=256',
    });
    expect(createdPayload.data.expiresAt).toBeInstanceOf(Date);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const replyPayload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { title?: string; description?: string; color?: number } }>;
      ephemeral: boolean;
    };

    expect(replyPayload.ephemeral).toBe(true);
    expect(replyPayload.embeds[0].toJSON()).toMatchObject({
      title: 'Pairing code ready',
      description: 'code=AAAAAA;ttl=20;api=https://api.livechat.test',
      color: 0x3498db,
    });
  });

  it('supports invite mode and uses fallback author metadata when guild avatar is unavailable', async () => {
    const randomBytesSpy = vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.alloc(6, 1));
    const interaction = createInteraction({
      mode: 'invite',
      memberNick: '   ',
      memberAvatar: null,
      globalName: 'Global Profile',
    });

    try {
      await overlayCodeCommand().handler(interaction as any);
    } finally {
      randomBytesSpy.mockRestore();
    }

    const createdPayload = global.prisma.pairingCode.create.mock.calls[0][0] as {
      data: {
        mode: string;
        authorName: string;
        authorImage: string;
        expiresAt: Date | null;
      };
    };

    expect(createdPayload.data.mode).toBe('INVITE_READ_ONLY');
    expect(createdPayload.data.authorName).toBe('Global Profile');
    expect(createdPayload.data.authorImage).toBe('https://cdn.discordapp.com/users/default.png');
    expect(createdPayload.data.expiresAt).toBeNull();
    expect(interaction.user.displayAvatarURL).toHaveBeenCalledWith({
      extension: 'png',
      size: 256,
    });

    const replyPayload = interaction.reply.mock.calls[0][0] as {
      embeds: Array<{ toJSON: () => { description?: string } }>;
    };

    expect(replyPayload.embeds[0].toJSON().description).toBe('invite=BBBBBB;api=https://api.livechat.test');
  });

  it('fails after repeated pairing-code collisions without creating or replying', async () => {
    const randomBytesSpy = vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.alloc(6, 0));
    global.prisma.pairingCode.findUnique.mockResolvedValue({
      code: 'AAAAAA',
    });

    const interaction = createInteraction();

    try {
      await expect(overlayCodeCommand().handler(interaction as any)).rejects.toThrow('unable_to_generate_pairing_code');
    } finally {
      randomBytesSpy.mockRestore();
    }

    expect(global.prisma.pairingCode.findUnique).toHaveBeenCalledTimes(5);
    expect(global.prisma.pairingCode.create).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
