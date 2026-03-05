import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const discordLoaderMocks = vi.hoisted(() => {
  const onceHandlers = new Map<string, (...args: unknown[]) => void>();
  const onHandlers = new Map<string, (...args: unknown[]) => void>();

  return {
    restCtorArgs: [] as unknown[],
    clientCtorArgs: [] as unknown[],
    restSetToken: vi.fn(),
    restPut: vi.fn(),
    clientLogin: vi.fn(),
    clientOnce: vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
      onceHandlers.set(eventName, handler);
    }),
    clientOn: vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
      onHandlers.set(eventName, handler);
    }),
    routesApplicationCommands: vi.fn((applicationId: string) => `route:${applicationId}`),
    assembleDiscordCommandMetadata: vi.fn(),
    createDiscordCommandRegistry: vi.fn(),
    registerDiscordCommandRegistry: vi.fn(),
    registerDiscordInteractionExecutionHandler: vi.fn(),
    getOnceHandler: (eventName: string) => onceHandlers.get(eventName),
    getOnHandler: (eventName: string) => onHandlers.get(eventName),
    clearHandlers: () => {
      onceHandlers.clear();
      onHandlers.clear();
    },
  };
});

vi.mock('discord.js', () => {
  class REST {
    public put = discordLoaderMocks.restPut;

    constructor(options: unknown) {
      discordLoaderMocks.restCtorArgs.push(options);
    }

    setToken(token: string) {
      discordLoaderMocks.restSetToken(token);
      return this;
    }
  }

  class Client {
    public once = discordLoaderMocks.clientOnce;
    public on = discordLoaderMocks.clientOn;
    public login = discordLoaderMocks.clientLogin;

    constructor(options: unknown) {
      discordLoaderMocks.clientCtorArgs.push(options);
    }
  }

  class EmbedBuilder {
    public title: string | undefined;
    public description: string | undefined;
    public color: number | undefined;

    setTitle(value: string) {
      this.title = value;
      return this;
    }

    setDescription(value: string) {
      this.description = value;
      return this;
    }

    setColor(value: number) {
      this.color = value;
      return this;
    }
  }

  return {
    REST,
    Client,
    EmbedBuilder,
    Events: {
      ClientReady: 'client-ready',
      GuildCreate: 'guild-create',
      Error: 'error',
      InteractionCreate: 'interaction-create',
    },
    Routes: {
      applicationCommands: discordLoaderMocks.routesApplicationCommands,
    },
    ChannelType: {
      GuildText: 'guild-text',
    },
    PermissionFlagsBits: {
      SendMessages: 'send-messages',
    },
    IntentsBitField: {
      Flags: {
        Guilds: 'guild-intent',
      },
    },
  };
});

vi.mock('../../../src/loaders/discord/commandMetadata', () => {
  return {
    assembleDiscordCommandMetadata: discordLoaderMocks.assembleDiscordCommandMetadata,
  };
});

vi.mock('../../../src/loaders/discord/commandRegistry', () => {
  return {
    createDiscordCommandRegistry: discordLoaderMocks.createDiscordCommandRegistry,
    registerDiscordCommandRegistry: discordLoaderMocks.registerDiscordCommandRegistry,
  };
});

vi.mock('../../../src/loaders/discord/interactionExecution', () => {
  return {
    registerDiscordInteractionExecutionHandler: discordLoaderMocks.registerDiscordInteractionExecutionHandler,
  };
});

import { loadDiscord, loadDiscordCommandsHandler } from '../../../src/loaders/DiscordLoader';

const createCommand = (name: string) => {
  return {
    data: {
      name,
      toJSON: vi.fn(() => ({ name })),
    },
    handler: vi.fn(async () => undefined),
  };
};

describe('loaders/DiscordLoader', () => {
  beforeEach(() => {
    discordLoaderMocks.restCtorArgs.length = 0;
    discordLoaderMocks.clientCtorArgs.length = 0;
    discordLoaderMocks.restSetToken.mockReset();
    discordLoaderMocks.restPut.mockReset();
    discordLoaderMocks.clientLogin.mockReset();
    discordLoaderMocks.clientOnce.mockReset();
    discordLoaderMocks.clientOn.mockReset();
    discordLoaderMocks.routesApplicationCommands.mockClear();
    discordLoaderMocks.assembleDiscordCommandMetadata.mockReset();
    discordLoaderMocks.createDiscordCommandRegistry.mockReset();
    discordLoaderMocks.registerDiscordCommandRegistry.mockReset();
    discordLoaderMocks.registerDiscordInteractionExecutionHandler.mockReset();
    discordLoaderMocks.clearHandlers();

    discordLoaderMocks.clientLogin.mockResolvedValue(undefined);
    discordLoaderMocks.assembleDiscordCommandMetadata.mockReturnValue([{ name: 'alive' }]);
    discordLoaderMocks.createDiscordCommandRegistry.mockReturnValue([createCommand('alive')]);

    global.env = {
      DISCORD_TOKEN: 'discord-token',
      DISCORD_CLIENT_ID: 'discord-client-id',
    } as any;

    global.logger = {
      info: vi.fn(),
      error: vi.fn(),
    } as any;

    global.rosetty = {
      t: vi.fn((key: string) => `${key}-translation`),
    } as any;

    global.discordClient = undefined as any;
    global.discordRest = undefined as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Discord rest/client, registers commands, and wires listeners', async () => {
    const fastify = { plugin: 'fastify' } as unknown as FastifyCustomInstance;

    await loadDiscord(fastify);

    expect(discordLoaderMocks.restCtorArgs).toEqual([{ version: '10' }]);
    expect(discordLoaderMocks.restSetToken).toHaveBeenCalledWith('discord-token');
    expect(discordLoaderMocks.clientCtorArgs).toEqual([{ intents: ['guild-intent'] }]);

    const commands = discordLoaderMocks.createDiscordCommandRegistry.mock.results[0]?.value;
    expect(discordLoaderMocks.createDiscordCommandRegistry).toHaveBeenCalledWith(fastify);
    expect(discordLoaderMocks.registerDiscordCommandRegistry).toHaveBeenCalledWith(global.discordClient, commands);
    expect(discordLoaderMocks.assembleDiscordCommandMetadata).toHaveBeenCalledWith(commands);
    expect(discordLoaderMocks.routesApplicationCommands).toHaveBeenCalledWith('discord-client-id');
    expect(discordLoaderMocks.restPut).toHaveBeenCalledWith('route:discord-client-id', {
      body: [{ name: 'alive' }],
    });

    expect(discordLoaderMocks.registerDiscordInteractionExecutionHandler).toHaveBeenCalledWith(global.discordClient);
    expect(discordLoaderMocks.clientLogin).toHaveBeenCalledWith('discord-token');

    const readyHandler = discordLoaderMocks.getOnceHandler('client-ready');
    if (!readyHandler) {
      throw new Error('Expected ready handler to be registered');
    }

    readyHandler({ user: { tag: 'livechat#0001' } });

    expect(global.rosetty.t).toHaveBeenCalledWith('discordBotReady', {
      username: 'livechat#0001',
    });
    expect(global.rosetty.t).toHaveBeenCalledWith('discordInvite', {
      link: 'https://discord.com/oauth2/authorize?client_id=discord-client-id&scope=bot',
    });

    const guildCreateHandler = discordLoaderMocks.getOnHandler('guild-create');
    if (!guildCreateHandler) {
      throw new Error('Expected guild create handler to be registered');
    }

    const send = vi.fn();
    const textChannel = {
      type: 'guild-text',
      permissionsFor: vi.fn(() => ({ has: vi.fn(() => true) })),
      isTextBased: () => true,
      send,
    };
    const guild = {
      channels: {
        cache: {
          find: vi.fn((predicate: (channel: typeof textChannel) => boolean) =>
            predicate(textChannel) ? textChannel : null,
          ),
        },
      },
      members: {
        me: { id: 'member-1' },
      },
    };

    guildCreateHandler(guild);

    expect(send).toHaveBeenCalledTimes(1);
    const sentPayload = send.mock.calls[0][0] as { embeds: unknown[] };
    expect(sentPayload.embeds).toHaveLength(1);

    const errorHandler = discordLoaderMocks.getOnHandler('error');
    if (!errorHandler) {
      throw new Error('Expected error handler to be registered');
    }

    const discordError = new Error('discord-client-failure');
    errorHandler(discordError);

    expect(global.logger.error).toHaveBeenCalledWith(discordError, '[DISCORD] Client error');
  });

  it('logs command registration errors and keeps loader flow alive', async () => {
    const registrationError = new Error('registry-failed');
    discordLoaderMocks.createDiscordCommandRegistry.mockImplementation(() => {
      throw registrationError;
    });

    await expect(loadDiscord({} as FastifyCustomInstance)).resolves.toBeUndefined();

    expect(global.logger.error).toHaveBeenCalledWith(registrationError);
    expect(discordLoaderMocks.restPut).not.toHaveBeenCalled();
    expect(discordLoaderMocks.registerDiscordInteractionExecutionHandler).toHaveBeenCalledWith(global.discordClient);
    expect(discordLoaderMocks.clientLogin).toHaveBeenCalledWith('discord-token');
  });

  it('logs login failures without throwing', async () => {
    const loginError = new Error('login-failed');
    discordLoaderMocks.clientLogin.mockRejectedValue(loginError);

    await expect(loadDiscord({} as FastifyCustomInstance)).resolves.toBeUndefined();

    expect(global.logger.error).toHaveBeenCalledWith(loginError, '[DISCORD] Login failed');
  });

  it('delegates interaction handler registration through the loader alias', () => {
    global.discordClient = { id: 'discord-client' } as any;

    loadDiscordCommandsHandler();

    expect(discordLoaderMocks.registerDiscordInteractionExecutionHandler).toHaveBeenCalledWith(global.discordClient);
  });
});
