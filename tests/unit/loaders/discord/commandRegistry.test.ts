import { Collection } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandFactoryMocks = vi.hoisted(() => {
  return {
    aliveCommand: vi.fn(),
    sendCommand: vi.fn(),
    talkCommand: vi.fn(),
    overlayCodeCommand: vi.fn(),
    helpCommand: vi.fn(),
    infoCommand: vi.fn(),
    setDefaultTimeCommand: vi.fn(),
    setDisplayMediaFullCommand: vi.fn(),
    setMaxTimeCommand: vi.fn(),
    overlaysCommand: vi.fn(),
    stopCommand: vi.fn(),
    memeAddCommand: vi.fn(),
    hideSendCommand: vi.fn(),
    hideTalkCommand: vi.fn(),
  };
});

vi.mock('../../../../src/components/discord/aliveCommand', () => {
  return {
    aliveCommand: commandFactoryMocks.aliveCommand,
  };
});

vi.mock('../../../../src/components/messages/sendCommand', () => {
  return {
    sendCommand: commandFactoryMocks.sendCommand,
  };
});

vi.mock('../../../../src/components/messages/talkCommand', () => {
  return {
    talkCommand: commandFactoryMocks.talkCommand,
  };
});

vi.mock('../../../../src/components/discord/clientCommand', () => {
  return {
    overlayCodeCommand: commandFactoryMocks.overlayCodeCommand,
  };
});

vi.mock('../../../../src/components/discord/helpCommand', () => {
  return {
    helpCommand: commandFactoryMocks.helpCommand,
  };
});

vi.mock('../../../../src/components/discord/infoCommand', () => {
  return {
    infoCommand: commandFactoryMocks.infoCommand,
  };
});

vi.mock('../../../../src/components/discord/setDefaultTimeCommand', () => {
  return {
    setDefaultTimeCommand: commandFactoryMocks.setDefaultTimeCommand,
  };
});

vi.mock('../../../../src/components/discord/setDisplayFullCommand', () => {
  return {
    setDisplayMediaFullCommand: commandFactoryMocks.setDisplayMediaFullCommand,
  };
});

vi.mock('../../../../src/components/discord/setMaxTimeCommand', () => {
  return {
    setMaxTimeCommand: commandFactoryMocks.setMaxTimeCommand,
  };
});

vi.mock('../../../../src/components/discord/overlaysCommand', () => {
  return {
    overlaysCommand: commandFactoryMocks.overlaysCommand,
  };
});

vi.mock('../../../../src/components/messages/stopCommand', () => {
  return {
    stopCommand: commandFactoryMocks.stopCommand,
  };
});

vi.mock('../../../../src/components/discord/memeAddCommand', () => {
  return {
    memeAddCommand: commandFactoryMocks.memeAddCommand,
  };
});

vi.mock('../../../../src/components/messages/hidesendCommand', () => {
  return {
    hideSendCommand: commandFactoryMocks.hideSendCommand,
  };
});

vi.mock('../../../../src/components/messages/hidetalkCommand', () => {
  return {
    hideTalkCommand: commandFactoryMocks.hideTalkCommand,
  };
});

import { createDiscordCommandRegistry, registerDiscordCommandRegistry } from '../../../../src/loaders/discord/commandRegistry';
import type { DiscordCommand } from '../../../../src/loaders/discord/types';

const createCommand = (name: string): DiscordCommand => {
  return {
    data: {
      name,
      toJSON: vi.fn(() => ({ name })),
    },
    handler: vi.fn(async () => undefined),
  };
};

describe('loaders/discord/commandRegistry', () => {
  beforeEach(() => {
    commandFactoryMocks.aliveCommand.mockReset();
    commandFactoryMocks.sendCommand.mockReset();
    commandFactoryMocks.talkCommand.mockReset();
    commandFactoryMocks.overlayCodeCommand.mockReset();
    commandFactoryMocks.helpCommand.mockReset();
    commandFactoryMocks.infoCommand.mockReset();
    commandFactoryMocks.setDefaultTimeCommand.mockReset();
    commandFactoryMocks.setDisplayMediaFullCommand.mockReset();
    commandFactoryMocks.setMaxTimeCommand.mockReset();
    commandFactoryMocks.overlaysCommand.mockReset();
    commandFactoryMocks.stopCommand.mockReset();
    commandFactoryMocks.memeAddCommand.mockReset();
    commandFactoryMocks.hideSendCommand.mockReset();
    commandFactoryMocks.hideTalkCommand.mockReset();

    commandFactoryMocks.aliveCommand.mockReturnValue(createCommand('alive'));
    commandFactoryMocks.sendCommand.mockReturnValue(createCommand('send'));
    commandFactoryMocks.talkCommand.mockReturnValue(createCommand('talk'));
    commandFactoryMocks.overlayCodeCommand.mockReturnValue(createCommand('overlay-code'));
    commandFactoryMocks.helpCommand.mockReturnValue(createCommand('help'));
    commandFactoryMocks.infoCommand.mockReturnValue(createCommand('info'));
    commandFactoryMocks.setDefaultTimeCommand.mockReturnValue(createCommand('set-default-time'));
    commandFactoryMocks.setDisplayMediaFullCommand.mockReturnValue(createCommand('set-display-media-full'));
    commandFactoryMocks.setMaxTimeCommand.mockReturnValue(createCommand('set-max-time'));
    commandFactoryMocks.overlaysCommand.mockReturnValue(createCommand('overlays'));
    commandFactoryMocks.stopCommand.mockReturnValue(createCommand('stop'));
    commandFactoryMocks.memeAddCommand.mockReturnValue(createCommand('meme-add'));
    commandFactoryMocks.hideSendCommand.mockReturnValue(createCommand('hide-send'));
    commandFactoryMocks.hideTalkCommand.mockReturnValue(createCommand('hide-talk'));

    global.logger = {
      info: vi.fn(),
    } as any;

    global.rosetty = {
      t: vi.fn((key: string, values?: Record<string, unknown>) => {
        return key === 'discordCommandLoaded' ? `loaded:${String(values?.command ?? '')}` : key;
      }),
    } as any;

    global.commandsLoaded = [];
  });

  it('builds the command registry including hidden commands when enabled', () => {
    global.env = {
      HIDE_COMMANDS_DISABLED: 'false',
    } as any;

    const fastify = { service: 'fastify' } as unknown as FastifyCustomInstance;

    const commands = createDiscordCommandRegistry(fastify);

    expect(commandFactoryMocks.overlaysCommand).toHaveBeenCalledWith(fastify);
    expect(commandFactoryMocks.stopCommand).toHaveBeenCalledWith(fastify);
    expect(commandFactoryMocks.hideSendCommand).toHaveBeenCalledTimes(1);
    expect(commandFactoryMocks.hideTalkCommand).toHaveBeenCalledTimes(1);

    expect(commands.map((command) => command.data.name)).toEqual([
      'alive',
      'send',
      'talk',
      'overlay-code',
      'help',
      'info',
      'set-default-time',
      'set-display-media-full',
      'set-max-time',
      'overlays',
      'stop',
      'meme-add',
      'hide-send',
      'hide-talk',
    ]);
  });

  it('omits hidden commands when hide-commands mode is disabled', () => {
    global.env = {
      HIDE_COMMANDS_DISABLED: 'true',
    } as any;

    const fastify = { service: 'fastify' } as unknown as FastifyCustomInstance;

    const commands = createDiscordCommandRegistry(fastify);

    expect(commandFactoryMocks.hideSendCommand).not.toHaveBeenCalled();
    expect(commandFactoryMocks.hideTalkCommand).not.toHaveBeenCalled();
    expect(commands.map((command) => command.data.name)).not.toContain('hide-send');
    expect(commands.map((command) => command.data.name)).not.toContain('hide-talk');
  });

  it('registers commands onto the Discord client and logs each load', () => {
    const client = {} as any;
    const commands = [createCommand('alive'), createCommand('help')];

    registerDiscordCommandRegistry(client, commands);

    expect(client.commands).toBeInstanceOf(Collection);
    expect(client.commands.get('alive')).toBe(commands[0]);
    expect(client.commands.get('help')).toBe(commands[1]);
    expect(global.commandsLoaded).toEqual(['alive', 'help']);
    expect(global.logger.info).toHaveBeenNthCalledWith(1, '[DISCORD] loaded:alive');
    expect(global.logger.info).toHaveBeenNthCalledWith(2, '[DISCORD] loaded:help');
  });

  it('keeps duplicate command names in load history while latest handler wins', () => {
    const client = {} as any;
    const first = createCommand('dupe');
    const second = createCommand('dupe');

    registerDiscordCommandRegistry(client, [first, second]);

    expect(client.commands.get('dupe')).toBe(second);
    expect(client.commands.size).toBe(1);
    expect(global.commandsLoaded).toEqual(['dupe', 'dupe']);
  });
});
