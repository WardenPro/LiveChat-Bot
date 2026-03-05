import { describe, expect, it, vi } from 'vitest';

import { assembleDiscordCommandMetadata } from '../../../../src/loaders/discord/commandMetadata';
import type { DiscordCommand } from '../../../../src/loaders/discord/types';

const createCommand = (name: string, payload: Record<string, unknown>): DiscordCommand => {
  return {
    data: {
      name,
      toJSON: vi.fn(() => payload),
    },
    handler: vi.fn(async () => undefined),
  };
};

describe('loaders/discord/commandMetadata', () => {
  it('maps command metadata to JSON in declaration order', () => {
    const first = createCommand('first', { name: 'first', description: 'first command' });
    const second = createCommand('second', { name: 'second', description: 'second command' });

    const metadata = assembleDiscordCommandMetadata([first, second]);

    expect(metadata).toEqual([
      { name: 'first', description: 'first command' },
      { name: 'second', description: 'second command' },
    ]);
    expect(first.data.toJSON).toHaveBeenCalledTimes(1);
    expect(second.data.toJSON).toHaveBeenCalledTimes(1);
  });

  it('surfaces metadata serialization failures to the caller', () => {
    const serializationError = new Error('metadata-failed');
    const brokenCommand = {
      data: {
        name: 'broken',
        toJSON: vi.fn(() => {
          throw serializationError;
        }),
      },
      handler: vi.fn(async () => undefined),
    } as unknown as DiscordCommand;

    expect(() => assembleDiscordCommandMetadata([brokenCommand])).toThrow(serializationError);
  });
});
