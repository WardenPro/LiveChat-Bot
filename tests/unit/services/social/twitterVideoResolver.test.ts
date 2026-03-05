import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedEnv = vi.hoisted(() => {
  return {
    I18N: 'en',
    MEDIA_DOWNLOAD_TIMEOUT_MS: 5000,
    TWITTER_VIDEO_RESOLVER_BASE_URL: 'https://twitsave.com',
  };
});

vi.mock('../../../../src/services/env', () => {
  return {
    env: mockedEnv,
  };
});

const fetchMocks = vi.hoisted(() => {
  return {
    fetch: vi.fn(),
  };
});

vi.mock('node-fetch', () => {
  return {
    default: fetchMocks.fetch,
  };
});

import {
  extractTweetStatusIdFromUrl,
  resolveTweetVideoMediaFromUrl,
  resolveTweetVideoMediasFromUrl,
} from '../../../../src/services/social/twitterVideoResolver';

describe('services/social/twitterVideoResolver', () => {
  beforeEach(() => {
    fetchMocks.fetch.mockReset();

    Object.assign(mockedEnv, {
      I18N: 'en',
      MEDIA_DOWNLOAD_TIMEOUT_MS: 5000,
      TWITTER_VIDEO_RESOLVER_BASE_URL: 'https://twitsave.com',
    });

    global.env = mockedEnv as any;
  });

  describe('extractTweetStatusIdFromUrl', () => {
    it('extracts the numeric status ID from a valid tweet URL', () => {
      const id = extractTweetStatusIdFromUrl('https://x.com/user/status/1234567890');
      expect(id).toBe('1234567890');
    });

    it('returns null for a non-tweet URL', () => {
      expect(extractTweetStatusIdFromUrl('https://example.com/page')).toBeNull();
    });

    it('returns null for null or undefined input', () => {
      expect(extractTweetStatusIdFromUrl(null)).toBeNull();
      expect(extractTweetStatusIdFromUrl(undefined)).toBeNull();
    });
  });

  describe('resolveTweetVideoMediasFromUrl', () => {
    it('returns an empty array for null input', async () => {
      const result = await resolveTweetVideoMediasFromUrl(null);
      expect(result).toEqual([]);
      expect(fetchMocks.fetch).not.toHaveBeenCalled();
    });

    it('returns an empty array for a non-tweet URL', async () => {
      const result = await resolveTweetVideoMediasFromUrl('https://example.com/notabird');
      expect(result).toEqual([]);
    });

    it('returns resolved video media from syndication payload with mp4 variant', async () => {
      const syndicationPayload = {
        id_str: '9999',
        mediaDetails: [
          {
            expanded_url: 'https://x.com/user/status/9999/video/1',
            video_info: {
              duration_millis: 12000,
              variants: [
                { url: 'https://video.twimg.com/clip.mp4', content_type: 'video/mp4', bitrate: 2176000 },
              ],
            },
          },
        ],
      };

      fetchMocks.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => syndicationPayload,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => syndicationPayload,
        });

      const result = await resolveTweetVideoMediasFromUrl('https://x.com/user/status/9999');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].url).toContain('video.twimg.com');
      expect(result[0].mime).toContain('video/');
    });

    it('falls back to resolver HTML when syndication returns no variants', async () => {
      fetchMocks.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id_str: '1111' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id_str: '1111' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            '<meta property="og:video:secure_url" content="https://video.twimg.com/fallback.mp4">',
        });

      const result = await resolveTweetVideoMediasFromUrl('https://x.com/user/status/1111');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].url).toContain('fallback.mp4');
    });

    it('returns empty array when all resolution paths fail', async () => {
      fetchMocks.fetch.mockResolvedValue({
        ok: false,
        json: async () => null,
        text: async () => null,
      });

      const result = await resolveTweetVideoMediasFromUrl('https://x.com/user/status/8888');

      expect(result).toEqual([]);
    });
  });

  describe('resolveTweetVideoMediaFromUrl', () => {
    it('returns the first resolved media or null', async () => {
      fetchMocks.fetch.mockResolvedValue({
        ok: false,
        json: async () => null,
        text: async () => null,
      });

      const result = await resolveTweetVideoMediaFromUrl('https://x.com/user/status/7777');
      expect(result).toBeNull();
    });
  });
});
