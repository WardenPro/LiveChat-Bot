import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    fetch: vi.fn(),
    normalizeTweetStatusUrl: vi.fn(),
    resolveTweetVideoMediaFromUrl: vi.fn(),
  };
});

vi.mock('node-fetch', () => {
  return {
    default: mocks.fetch,
  };
});

vi.mock('../../../../src/services/social/twitterOEmbed', () => {
  return {
    normalizeTweetStatusUrl: mocks.normalizeTweetStatusUrl,
  };
});

vi.mock('../../../../src/services/social/twitterVideoResolver', () => {
  return {
    resolveTweetVideoMediaFromUrl: mocks.resolveTweetVideoMediaFromUrl,
  };
});

import {
  buildSourceHash,
  canonicalizeSourceUrl,
  extractMediaStartOffsetSec,
  resolveMediaSource,
} from '../../../../src/services/media/mediaSourceResolver';

describe('services/media/mediaSourceResolver', () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.normalizeTweetStatusUrl.mockReset();
    mocks.resolveTweetVideoMediaFromUrl.mockReset();

    mocks.normalizeTweetStatusUrl.mockReturnValue(null);
    mocks.resolveTweetVideoMediaFromUrl.mockResolvedValue(null);
  });

  it('canonicalizes supported platform URLs and strips transient URL fragments', () => {
    expect(canonicalizeSourceUrl('https://youtu.be/abc123?t=1m2s')).toBe('https://www.youtube.com/watch?v=abc123');
    expect(canonicalizeSourceUrl('https://www.tiktok.com/video/12345?lang=en#share')).toBe(
      'https://www.tiktok.com/@_/video/12345',
    );
    expect(canonicalizeSourceUrl('https://cdn.example/video.mp4?token=abc#fragment')).toBe(
      'https://cdn.example/video.mp4?token=abc',
    );
  });

  it('extracts YouTube start offsets and ignores non-YouTube sources', () => {
    expect(extractMediaStartOffsetSec({ url: 'https://www.youtube.com/watch?v=demo&t=1h2m3s' })).toBe(3723);
    expect(extractMediaStartOffsetSec({ media: 'https://youtu.be/demo#t=90' })).toBe(90);
    expect(extractMediaStartOffsetSec({ url: 'https://vimeo.com/123' })).toBeNull();
  });

  it('returns null when no source URL can be resolved', async () => {
    await expect(resolveMediaSource({ url: '   ', media: null })).resolves.toBeNull();
  });

  it('normalizes tweet sources and replaces with resolved tweet media URL when available', async () => {
    mocks.normalizeTweetStatusUrl.mockReturnValue('https://x.com/example/status/1');
    mocks.resolveTweetVideoMediaFromUrl.mockResolvedValue({
      url: 'https://video.twimg.com/amplify_video/example.mp4',
    });

    const result = await resolveMediaSource({
      url: 'https://x.com/example/status/1?s=20',
    });

    expect(result).not.toBeNull();
    expect(result?.sourceUrl).toBe('https://video.twimg.com/amplify_video/example.mp4');
    expect(result?.sourceHash).toBe(buildSourceHash('https://video.twimg.com/amplify_video/example.mp4'));
  });

  it('resolves TikTok short links via HEAD/GET and canonicalizes final URL', async () => {
    mocks.fetch
      .mockResolvedValueOnce({
        url: 'https://www.tiktok.com/video/998877',
        body: {
          destroy: vi.fn(),
        },
      })
      .mockRejectedValueOnce(new Error('HEAD blocked'))
      .mockResolvedValueOnce({
        url: 'https://www.tiktok.com/photo/223344',
        body: {
          destroy: vi.fn(),
        },
      });

    const headResolved = await resolveMediaSource({
      url: 'https://vm.tiktok.com/abcde/',
    });
    const fallbackResolved = await resolveMediaSource({
      media: 'https://vt.tiktok.com/xyz/',
    });

    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      'https://vm.tiktok.com/abcde/',
      expect.objectContaining({ method: 'HEAD', redirect: 'follow' }),
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      3,
      'https://vt.tiktok.com/xyz/',
      expect.objectContaining({ method: 'GET', redirect: 'follow' }),
    );

    expect(headResolved?.sourceUrl).toBe('https://www.tiktok.com/@_/video/998877');
    expect(fallbackResolved?.sourceUrl).toBe('https://www.tiktok.com/@_/photo/223344');
  });
});
