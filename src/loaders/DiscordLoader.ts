import {
  REST,
  Client,
  Events,
  Routes,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  IntentsBitField,
} from 'discord.js';

import { assembleDiscordCommandMetadata } from './discord/commandMetadata';
import { createDiscordCommandRegistry, registerDiscordCommandRegistry } from './discord/commandRegistry';
import { registerDiscordInteractionExecutionHandler } from './discord/interactionExecution';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const loadDiscord = async (fastify: FastifyCustomInstance) => {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  global.discordRest = rest;

  const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });
  global.discordClient = client;

  // Load all discord commands
  await loadDiscordCommands(fastify);
  loadDiscordCommandsHandler();

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`[DISCORD] ${rosetty.t('discordBotReady', { username: readyClient.user.tag })}`);
    logger.info(
      `[DISCORD] ${rosetty.t('discordInvite', {
        link: `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=bot`,
      })}`,
    );
  });

  client.on(Events.GuildCreate, (g) => {
    const channel = g.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.permissionsFor(g.members.me!).has(PermissionFlagsBits.SendMessages),
    );

    if (channel && channel.isTextBased()) {
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('howToUseTitle')!)
            .setDescription(rosetty.t('howToUseDescription')!)
            .setColor(0x3498db),
        ],
      });
    }
  });

  client.on(Events.Error, (error) => {
    logger.error(error, '[DISCORD] Client error');
  });

  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (error) {
    logger.error(error, '[DISCORD] Login failed');
  }
};

const loadDiscordCommands = async (fastify: FastifyCustomInstance) => {
  try {
    logger.info(`[DISCORD] ${rosetty.t('discordCommands')}`);

    const commands = createDiscordCommandRegistry(fastify);
    registerDiscordCommandRegistry(discordClient, commands);
    const discordCommandsToRegister = assembleDiscordCommandMetadata(commands);

    await discordRest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: discordCommandsToRegister });
  } catch (error) {
    logger.error(error);
  }
};

export const loadDiscordCommandsHandler = () => {
  registerDiscordInteractionExecutionHandler(discordClient);
};
