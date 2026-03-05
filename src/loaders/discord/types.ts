import { Client, Collection } from 'discord.js';
import type { ChatInputCommandInteraction, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

export interface DiscordCommand {
  data: {
    name: string;
    toJSON: () => RESTPostAPIApplicationCommandsJSONBody;
  };
  handler: (interaction: ChatInputCommandInteraction, discordClient: Client) => Promise<void>;
}

export interface DiscordCommandClient extends Client {
  commands: Collection<string, DiscordCommand>;
}

export const asDiscordCommandClient = (client: Client): DiscordCommandClient => {
  return client as DiscordCommandClient;
};
