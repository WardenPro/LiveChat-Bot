import type { Client } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { asDiscordCommandClient } from '../../../../src/loaders/discord/types';

describe('loaders/discord/types', () => {
  it('returns the same client instance when casting to DiscordCommandClient', () => {
    const client = { id: 'client-1' } as unknown as Client;

    const commandClient = asDiscordCommandClient(client);

    expect(commandClient).toBe(client);
  });

  it('does not initialize commands during casting', () => {
    const client = { id: 'client-2' } as unknown as Client;

    const commandClient = asDiscordCommandClient(client);

    expect(commandClient.commands).toBeUndefined();
  });
});
