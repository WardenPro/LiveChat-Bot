import Module from 'module';

import { ensureCharacterizationGlobals, toValueShape } from './utils';

interface FakeDiscordCommand {
  handler: (interaction: FakeDiscordInteraction) => Promise<void>;
}

interface FakeDiscordInteraction {
  commandName: string;
  replied: boolean;
  deferred: boolean;
  isChatInputCommand: () => boolean;
  reply: (payload: unknown) => Promise<void>;
  followUp: (payload: unknown) => Promise<void>;
}

class FakeDiscordClient {
  public commands = new Map<string, FakeDiscordCommand>();
  private readonly eventHandlers = new Map<string, Array<(payload: FakeDiscordInteraction) => Promise<void> | void>>();

  on(eventName: string, handler: (payload: FakeDiscordInteraction) => Promise<void> | void) {
    const handlers = this.eventHandlers.get(eventName) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventName, handlers);
  }

  async emit(eventName: string, payload: FakeDiscordInteraction) {
    const handlers = this.eventHandlers.get(eventName) || [];

    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

const makeStubCommandFactory = (name: string) => {
  return () => ({
    data: {
      name,
      toJSON: () => ({
        name,
      }),
    },
    handler: async () => undefined,
  });
};

const loadDiscordCommandsHandler = async () => {
  const moduleLoader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };

  const commandModuleStubs = new Map<string, Record<string, unknown>>([
    ['../components/discord/aliveCommand', { aliveCommand: makeStubCommandFactory('alive') }],
    ['../components/messages/sendCommand', { sendCommand: makeStubCommandFactory('send') }],
    ['../components/messages/hidesendCommand', { hideSendCommand: makeStubCommandFactory('hidesend') }],
    ['../components/messages/talkCommand', { talkCommand: makeStubCommandFactory('talk') }],
    ['../components/messages/hidetalkCommand', { hideTalkCommand: makeStubCommandFactory('hidetalk') }],
    ['../components/discord/clientCommand', { overlayCodeCommand: makeStubCommandFactory('client') }],
    ['../components/discord/helpCommand', { helpCommand: makeStubCommandFactory('help') }],
    ['../components/discord/infoCommand', { infoCommand: makeStubCommandFactory('info') }],
    ['../components/discord/setDefaultTimeCommand', { setDefaultTimeCommand: makeStubCommandFactory('setdefault') }],
    [
      '../components/discord/setDisplayFullCommand',
      { setDisplayMediaFullCommand: makeStubCommandFactory('setdisplayfull') },
    ],
    ['../components/discord/setMaxTimeCommand', { setMaxTimeCommand: makeStubCommandFactory('setmaxtime') }],
    ['../components/discord/overlaysCommand', { overlaysCommand: () => makeStubCommandFactory('overlays')() }],
    ['../components/messages/stopCommand', { stopCommand: () => makeStubCommandFactory('stop')() }],
    ['../components/discord/memeAddCommand', { memeAddCommand: makeStubCommandFactory('memeadd') }],
  ]);

  const originalLoad = moduleLoader._load;

  moduleLoader._load = (request: string, parent: unknown, isMain: boolean) => {
    const stubbedModule = commandModuleStubs.get(request);
    if (stubbedModule) {
      return stubbedModule;
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    const loaderModule = await import('../loaders/DiscordLoader');
    return loaderModule.loadDiscordCommandsHandler;
  } finally {
    moduleLoader._load = originalLoad;
  }
};

const createInteraction = (params: {
  commandName: string;
  replied?: boolean;
  deferred?: boolean;
  isChatInputCommand?: boolean;
}) => {
  const replies: unknown[] = [];
  const followUps: unknown[] = [];

  const interaction: FakeDiscordInteraction = {
    commandName: params.commandName,
    replied: !!params.replied,
    deferred: !!params.deferred,
    isChatInputCommand: () => {
      return params.isChatInputCommand !== false;
    },
    reply: async (payload: unknown) => {
      replies.push(payload);
    },
    followUp: async (payload: unknown) => {
      followUps.push(payload);
    },
  };

  return {
    interaction,
    replies,
    followUps,
  };
};

export const runDiscordExecutionCharacterization = async () => {
  ensureCharacterizationGlobals();

  const fakeDiscordClient = new FakeDiscordClient();
  fakeDiscordClient.commands.set('explode', {
    handler: async () => {
      throw new Error('handler_failed');
    },
  });

  global.discordClient = fakeDiscordClient as any;

  const registerHandler = await loadDiscordCommandsHandler();
  registerHandler();

  const unknownCommand = createInteraction({
    commandName: 'unknown-command',
  });

  await fakeDiscordClient.emit('interactionCreate', unknownCommand.interaction);

  const failingCommandWithoutReply = createInteraction({
    commandName: 'explode',
    replied: false,
    deferred: false,
  });

  await fakeDiscordClient.emit('interactionCreate', failingCommandWithoutReply.interaction);

  const failingCommandWithReply = createInteraction({
    commandName: 'explode',
    replied: true,
    deferred: false,
  });

  await fakeDiscordClient.emit('interactionCreate', failingCommandWithReply.interaction);

  return {
    unknownCommandInteraction: {
      replyCallCount: unknownCommand.replies.length,
      followUpCallCount: unknownCommand.followUps.length,
    },
    failingCommandBeforeReply: {
      replyCallCount: failingCommandWithoutReply.replies.length,
      followUpCallCount: failingCommandWithoutReply.followUps.length,
      replyShape:
        failingCommandWithoutReply.replies.length > 0 ? toValueShape(failingCommandWithoutReply.replies[0]) : null,
    },
    failingCommandAfterReply: {
      replyCallCount: failingCommandWithReply.replies.length,
      followUpCallCount: failingCommandWithReply.followUps.length,
      followUpShape:
        failingCommandWithReply.followUps.length > 0 ? toValueShape(failingCommandWithReply.followUps[0]) : null,
    },
  };
};
