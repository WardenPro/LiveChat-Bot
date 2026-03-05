import Module from 'module';
import { Collection } from 'discord.js';

import { ensureCharacterizationGlobals, toValueShape } from './utils';

const loadDiscordRegistrationModules = async () => {
  const moduleLoader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };

  const originalLoad = moduleLoader._load;

  moduleLoader._load = (request: string, parent: unknown, isMain: boolean) => {
    if (request === 'file-type') {
      return {
        fileTypeFromFile: async () => null,
      };
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    const commandRegistryModule = await import('../loaders/discord/commandRegistry');
    const commandMetadataModule = await import('../loaders/discord/commandMetadata');

    return {
      createDiscordCommandRegistry: commandRegistryModule.createDiscordCommandRegistry,
      registerDiscordCommandRegistry: commandRegistryModule.registerDiscordCommandRegistry,
      assembleDiscordCommandMetadata: commandMetadataModule.assembleDiscordCommandMetadata,
    };
  } finally {
    moduleLoader._load = originalLoad;
  }
};

const toStringOrNull = (value: unknown) => {
  return typeof value === 'string' ? value : null;
};

const toBooleanOrNull = (value: unknown) => {
  return typeof value === 'boolean' ? value : null;
};

const toNumberOrNull = (value: unknown) => {
  return typeof value === 'number' ? value : null;
};

const normalizeChoice = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return {
      name: null,
      value: null,
    };
  }

  const choice = value as Record<string, unknown>;
  const choiceValue = choice.value;

  return {
    name: toStringOrNull(choice.name),
    value: typeof choiceValue === 'string' || typeof choiceValue === 'number' ? choiceValue : null,
  };
};

const normalizeOption = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') {
    return {
      name: null,
      description: null,
      type: null,
      required: null,
      autocomplete: null,
      minValue: null,
      maxValue: null,
      minLength: null,
      maxLength: null,
      channelTypes: [],
      choices: [],
      options: [],
    };
  }

  const option = value as Record<string, unknown>;
  const rawChannelTypes = Array.isArray(option.channel_types) ? option.channel_types : [];
  const rawChoices = Array.isArray(option.choices) ? option.choices : [];
  const rawNestedOptions = Array.isArray(option.options) ? option.options : [];

  return {
    name: toStringOrNull(option.name),
    description: toStringOrNull(option.description),
    type: toNumberOrNull(option.type),
    required: toBooleanOrNull(option.required),
    autocomplete: toBooleanOrNull(option.autocomplete),
    minValue: toNumberOrNull(option.min_value),
    maxValue: toNumberOrNull(option.max_value),
    minLength: toNumberOrNull(option.min_length),
    maxLength: toNumberOrNull(option.max_length),
    channelTypes: rawChannelTypes.filter((entry): entry is number => typeof entry === 'number'),
    choices: rawChoices.map((entry) => normalizeChoice(entry)),
    options: rawNestedOptions.map((entry) => normalizeOption(entry)),
  };
};

const normalizeCommandPayload = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return {
      name: null,
      description: null,
      defaultMemberPermissions: null,
      dmPermission: null,
      nsfw: null,
      options: [],
    };
  }

  const command = value as Record<string, unknown>;
  const rawOptions = Array.isArray(command.options) ? command.options : [];

  return {
    name: toStringOrNull(command.name),
    description: toStringOrNull(command.description),
    defaultMemberPermissions: toStringOrNull(command.default_member_permissions),
    dmPermission: toBooleanOrNull(command.dm_permission),
    nsfw: toBooleanOrNull(command.nsfw),
    options: rawOptions.map((entry) => normalizeOption(entry)),
  };
};

export const runDiscordRegistrationCharacterization = async () => {
  ensureCharacterizationGlobals();
  const { loadRosetty } = await import('../services/i18n/loader');
  loadRosetty();

  const { createDiscordCommandRegistry, registerDiscordCommandRegistry, assembleDiscordCommandMetadata } =
    await loadDiscordRegistrationModules();

  const fakeFastify = {} as FastifyCustomInstance;
  const fakeDiscordClient = {
    commands: new Collection<string, unknown>(),
  };

  const commands = createDiscordCommandRegistry(fakeFastify);
  registerDiscordCommandRegistry(fakeDiscordClient as any, commands);

  const registrationPayload = assembleDiscordCommandMetadata(commands) as unknown as Array<Record<string, unknown>>;

  return {
    commandCount: registrationPayload.length,
    commandNames: registrationPayload.map((command) => toStringOrNull(command.name)),
    commandsLoaded: [...global.commandsLoaded],
    registrationPayloadShape: toValueShape(registrationPayload),
    registrationPayloadContract: registrationPayload.map((command) => normalizeCommandPayload(command)),
  };
};
