import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gttsMocks = vi.hoisted(() => {
  return {
    fetch: vi.fn(),
    createReadStream: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  };
});

vi.mock('node-fetch', () => {
  return {
    default: gttsMocks.fetch,
  };
});

vi.mock('fs', () => {
  return {
    createReadStream: gttsMocks.createReadStream,
  };
});

vi.mock('fs/promises', () => {
  return {
    writeFile: gttsMocks.writeFile,
    unlink: gttsMocks.unlink,
  };
});

import { deleteGtts, promisedGtts, readGttsAsStream } from '../../../src/services/gtts';

describe('services/gtts', () => {
  beforeEach(() => {
    gttsMocks.fetch.mockReset();
    gttsMocks.createReadStream.mockReset();
    gttsMocks.writeFile.mockReset();
    gttsMocks.unlink.mockReset();

    gttsMocks.writeFile.mockResolvedValue(undefined);
    gttsMocks.unlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches TTS chunks and writes a merged mp3 file', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.12);

    gttsMocks.fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    });

    const longText = `${'hello world '.repeat(20)}trim me`;
    const outputPath = await promisedGtts(longText, 'en-US');

    expect(gttsMocks.fetch).toHaveBeenCalledTimes(2);
    expect(gttsMocks.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('tl=en'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': expect.stringContaining('Mozilla'),
        }),
      }),
    );
    expect(gttsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/1700000000000-12.mp3'),
      Buffer.concat([Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])]),
    );
    expect(outputPath).toContain('/1700000000000-12.mp3');
  });

  it('rejects empty text input and non-ok HTTP responses', async () => {
    await expect(promisedGtts('   ', 'en')).rejects.toThrow('TTS text is empty');

    gttsMocks.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    await expect(promisedGtts('hello', 'fr')).rejects.toThrow('TTS request failed with status 503');
  });

  it('reads and deletes generated TTS files via fs adapters', async () => {
    const stream = {
      id: 'stream',
    };
    gttsMocks.createReadStream.mockReturnValue(stream);

    expect(readGttsAsStream('/tmp/sample.mp3')).toBe(stream);
    expect(gttsMocks.createReadStream).toHaveBeenCalledWith('/tmp/sample.mp3');

    await deleteGtts('/tmp/sample.mp3');
    expect(gttsMocks.unlink).toHaveBeenCalledWith('/tmp/sample.mp3');
  });
});
