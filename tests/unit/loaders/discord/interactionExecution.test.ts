import { Events } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeErrorHandlingMocks = vi.hoisted(() => {
  return {
    buildSafeErrorLogContext: vi.fn(),
    mapErrorToCommandOutput: vi.fn(),
  };
});

vi.mock('../../../../src/services/errors/runtimeErrorHandling', () => {
  return {
    buildSafeErrorLogContext: runtimeErrorHandlingMocks.buildSafeErrorLogContext,
    mapErrorToCommandOutput: runtimeErrorHandlingMocks.mapErrorToCommandOutput,
  };
});

import { registerDiscordInteractionExecutionHandler } from '../../../../src/loaders/discord/interactionExecution';

interface InteractionStub {
  isChatInputCommand: () => boolean;
  commandName: string;
  replied: boolean;
  deferred: boolean;
  reply: ReturnType<typeof vi.fn>;
  followUp: ReturnType<typeof vi.fn>;
}

const createClientHarness = () => {
  const eventHandlers = new Map<string, (interaction: InteractionStub) => Promise<void> | void>();
  const client = {
    on: vi.fn((eventName: string, handler: (interaction: InteractionStub) => Promise<void> | void) => {
      eventHandlers.set(eventName, handler);
    }),
    commands: new Map<string, { handler: (interaction: InteractionStub, client: unknown) => Promise<void> }>(),
  } as any;

  return {
    client,
    getInteractionHandler: () => eventHandlers.get(Events.InteractionCreate),
  };
};

const createInteraction = (overrides: Partial<InteractionStub> = {}): InteractionStub => {
  return {
    isChatInputCommand: () => true,
    commandName: 'alive',
    replied: false,
    deferred: false,
    reply: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    ...overrides,
  };
};

describe('loaders/discord/interactionExecution', () => {
  beforeEach(() => {
    runtimeErrorHandlingMocks.buildSafeErrorLogContext.mockReset();
    runtimeErrorHandlingMocks.mapErrorToCommandOutput.mockReset();
    runtimeErrorHandlingMocks.buildSafeErrorLogContext.mockReturnValue({ safe: true });
    runtimeErrorHandlingMocks.mapErrorToCommandOutput.mockReturnValue({
      category: 'unexpected',
      responseCode: 'command_error',
      logLevel: 'error',
    });

    global.logger = {
      error: vi.fn(),
    } as any;

    global.rosetty = {
      t: vi.fn((key: string) => `${key}-text`),
    } as any;
  });

  it('dispatches known interactions to the matching command handler', async () => {
    const harness = createClientHarness();
    const commandHandler = vi.fn(async () => undefined);
    harness.client.commands.set('alive', { handler: commandHandler });

    registerDiscordInteractionExecutionHandler(harness.client);

    const interactionHandler = harness.getInteractionHandler();
    if (!interactionHandler) {
      throw new Error('Expected interaction handler to be registered');
    }

    const interaction = createInteraction();
    await interactionHandler(interaction);

    expect(commandHandler).toHaveBeenCalledWith(interaction, harness.client);
    expect(runtimeErrorHandlingMocks.mapErrorToCommandOutput).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('ignores unknown command names without failing the loader flow', async () => {
    const harness = createClientHarness();

    registerDiscordInteractionExecutionHandler(harness.client);

    const interactionHandler = harness.getInteractionHandler();
    if (!interactionHandler) {
      throw new Error('Expected interaction handler to be registered');
    }

    const interaction = createInteraction({ commandName: 'unknown' });
    await interactionHandler(interaction);

    expect(runtimeErrorHandlingMocks.mapErrorToCommandOutput).not.toHaveBeenCalled();
    expect(global.logger.error).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('ignores non chat-input interactions', async () => {
    const harness = createClientHarness();
    const commandHandler = vi.fn(async () => undefined);
    harness.client.commands.set('alive', { handler: commandHandler });

    registerDiscordInteractionExecutionHandler(harness.client);

    const interactionHandler = harness.getInteractionHandler();
    if (!interactionHandler) {
      throw new Error('Expected interaction handler to be registered');
    }

    const interaction = createInteraction({
      isChatInputCommand: () => false,
    });
    await interactionHandler(interaction);

    expect(commandHandler).not.toHaveBeenCalled();
    expect(runtimeErrorHandlingMocks.mapErrorToCommandOutput).not.toHaveBeenCalled();
  });

  it('logs and replies with an error embed when command execution throws', async () => {
    const harness = createClientHarness();
    const commandFailure = new Error('command failed');
    const commandHandler = vi.fn(async () => {
      throw commandFailure;
    });
    harness.client.commands.set('alive', { handler: commandHandler });

    registerDiscordInteractionExecutionHandler(harness.client);

    const interactionHandler = harness.getInteractionHandler();
    if (!interactionHandler) {
      throw new Error('Expected interaction handler to be registered');
    }

    const interaction = createInteraction();
    await interactionHandler(interaction);

    expect(runtimeErrorHandlingMocks.mapErrorToCommandOutput).toHaveBeenCalledWith(commandFailure);
    expect(runtimeErrorHandlingMocks.buildSafeErrorLogContext).toHaveBeenCalledWith(commandFailure, {
      commandName: 'alive',
      category: 'unexpected',
      responseCode: 'command_error',
    });
    expect(global.logger.error).toHaveBeenCalledWith({ safe: true }, '[DISCORD] Command execution failed');
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0] as {
      embeds: unknown[];
      ephemeral: boolean;
    };

    expect(payload.ephemeral).toBe(true);
    expect(payload.embeds).toHaveLength(1);
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('uses follow-up when an interaction was already deferred', async () => {
    const harness = createClientHarness();
    const commandHandler = vi.fn(async () => {
      throw new Error('deferred command failed');
    });
    harness.client.commands.set('alive', { handler: commandHandler });

    registerDiscordInteractionExecutionHandler(harness.client);

    const interactionHandler = harness.getInteractionHandler();
    if (!interactionHandler) {
      throw new Error('Expected interaction handler to be registered');
    }

    const interaction = createInteraction({ deferred: true });
    await interactionHandler(interaction);

    expect(interaction.followUp).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
