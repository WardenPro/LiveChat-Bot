import { helpCommand } from '../components/discord/helpCommand';
import { registerDiscordInteractionExecutionHandler } from '../loaders/discord/interactionExecution';
import { OperationalError } from '../services/errors/runtimeErrorHandling';

import { ensureCharacterizationGlobals, toValueShape } from './utils';

interface FakeDiscordCommand {
  handler: (interaction: FakeDiscordInteraction, discordClient?: unknown) => Promise<void> | void;
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

const readEmbedValue = (payload: unknown, key: 'title' | 'description') => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const embeds = (payload as { embeds?: unknown }).embeds;

  if (!Array.isArray(embeds) || embeds.length === 0) {
    return null;
  }

  const firstEmbed = embeds[0] as { data?: Record<string, unknown> };
  const value = firstEmbed?.data?.[key];

  return typeof value === 'string' ? value : null;
};

const readEphemeralFlag = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const ephemeral = (payload as { ephemeral?: unknown }).ephemeral;
  return typeof ephemeral === 'boolean' ? ephemeral : null;
};

export const runDiscordExecutionCharacterization = async () => {
  ensureCharacterizationGlobals();
  global.commandsLoaded = ['alive', 'help', 'send'];

  const fakeDiscordClient = new FakeDiscordClient();
  fakeDiscordClient.commands.set('explode', {
    handler: async () => {
      throw new Error('handler_failed');
    },
  });
  fakeDiscordClient.commands.set('explode-operational', {
    handler: async () => {
      throw new OperationalError({
        category: 'operational',
        code: 'command_failed',
        message: 'command_token=super-secret-value',
        context: {
          token: 'super-secret-value',
        },
      });
    },
  });
  fakeDiscordClient.commands.set('help', helpCommand() as unknown as FakeDiscordCommand);

  global.discordClient = fakeDiscordClient as any;

  registerDiscordInteractionExecutionHandler(fakeDiscordClient as any);

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

  const failingOperationalCommand = createInteraction({
    commandName: 'explode-operational',
    replied: false,
    deferred: false,
  });

  await fakeDiscordClient.emit('interactionCreate', failingOperationalCommand.interaction);

  const helpCommandInteraction = createInteraction({
    commandName: 'help',
  });

  await fakeDiscordClient.emit('interactionCreate', helpCommandInteraction.interaction);

  const helpReply = helpCommandInteraction.replies.length > 0 ? helpCommandInteraction.replies[0] : null;

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
    failingOperationalCommandBeforeReply: {
      replyCallCount: failingOperationalCommand.replies.length,
      followUpCallCount: failingOperationalCommand.followUps.length,
      replyShape:
        failingOperationalCommand.replies.length > 0 ? toValueShape(failingOperationalCommand.replies[0]) : null,
    },
    helpCommandInteraction: {
      replyCallCount: helpCommandInteraction.replies.length,
      followUpCallCount: helpCommandInteraction.followUps.length,
      replyShape: helpReply ? toValueShape(helpReply) : null,
      replyTitle: readEmbedValue(helpReply, 'title'),
      replyDescription: readEmbedValue(helpReply, 'description'),
      ephemeral: readEphemeralFlag(helpReply),
    },
  };
};
