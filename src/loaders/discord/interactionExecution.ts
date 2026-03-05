import { Client, EmbedBuilder, Events } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

import { asDiscordCommandClient } from './types';

const buildCommandErrorPayload = () => {
  return {
    embeds: [
      new EmbedBuilder().setTitle(rosetty.t('error')!).setDescription(rosetty.t('commandError')!).setColor(0xe74c3c),
    ],
    ephemeral: true,
  };
};

const replyWithCommandError = async (interaction: ChatInputCommandInteraction) => {
  const payload = buildCommandErrorPayload();

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload);
    return;
  }

  await interaction.reply(payload);
};

export const registerDiscordInteractionExecutionHandler = (client: Client) => {
  const discordClient = asDiscordCommandClient(client);

  discordClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = discordClient.commands?.get(interaction.commandName);

    if (!command) {
      return;
    }

    try {
      await command.handler(interaction, discordClient);
    } catch (error) {
      logger.error(error);
      await replyWithCommandError(interaction);
    }
  });
};
