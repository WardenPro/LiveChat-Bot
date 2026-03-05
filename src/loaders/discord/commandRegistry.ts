import { Collection } from 'discord.js';
import type { Client } from 'discord.js';

import { aliveCommand } from '../../components/discord/aliveCommand';
import { overlayCodeCommand } from '../../components/discord/clientCommand';
import { helpCommand } from '../../components/discord/helpCommand';
import { infoCommand } from '../../components/discord/infoCommand';
import { memeAddCommand } from '../../components/discord/memeAddCommand';
import { overlaysCommand } from '../../components/discord/overlaysCommand';
import { setDefaultTimeCommand } from '../../components/discord/setDefaultTimeCommand';
import { setDisplayMediaFullCommand } from '../../components/discord/setDisplayFullCommand';
import { setMaxTimeCommand } from '../../components/discord/setMaxTimeCommand';
import { hideSendCommand } from '../../components/messages/hidesendCommand';
import { hideTalkCommand } from '../../components/messages/hidetalkCommand';
import { sendCommand } from '../../components/messages/sendCommand';
import { stopCommand } from '../../components/messages/stopCommand';
import { talkCommand } from '../../components/messages/talkCommand';

import { asDiscordCommandClient, type DiscordCommand } from './types';

const createBaseDiscordCommands = (fastify: FastifyCustomInstance): DiscordCommand[] => {
  return [
    aliveCommand(),
    sendCommand(),
    talkCommand(),
    overlayCodeCommand(),
    helpCommand(),
    infoCommand(),
    setDefaultTimeCommand(),
    setDisplayMediaFullCommand(),
    setMaxTimeCommand(),
    overlaysCommand(fastify),
    stopCommand(fastify),
    memeAddCommand(),
  ];
};

const createHiddenDiscordCommands = (): DiscordCommand[] => {
  return [hideSendCommand(), hideTalkCommand()];
};

export const createDiscordCommandRegistry = (fastify: FastifyCustomInstance): DiscordCommand[] => {
  const commands = createBaseDiscordCommands(fastify);

  if (env.HIDE_COMMANDS_DISABLED !== 'true') {
    commands.push(...createHiddenDiscordCommands());
  }

  return commands;
};

export const registerDiscordCommandRegistry = (client: Client, commands: DiscordCommand[]) => {
  const discordClient = asDiscordCommandClient(client);

  discordClient.commands = new Collection<string, DiscordCommand>();
  global.commandsLoaded = [];

  for (const command of commands) {
    discordClient.commands.set(command.data.name, command);
    global.commandsLoaded.push(command.data.name);

    logger.info(`[DISCORD] ${rosetty.t('discordCommandLoaded', { command: command.data.name })}`);
  }
};
