import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

import type { DiscordCommand } from './types';

export const assembleDiscordCommandMetadata = (
  commands: DiscordCommand[],
): RESTPostAPIApplicationCommandsJSONBody[] => {
  return commands.map((command) => command.data.toJSON());
};
