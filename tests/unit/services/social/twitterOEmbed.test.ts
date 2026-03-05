import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedEnv = vi.hoisted(() => {
  return {
    I18N: 'en',
    MEDIA_DOWNLOAD_TIMEOUT_MS: 5000,
    TWITTER_OEMBED_ENDPOINT: 'https://publish.twitter.com/oembed',
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
  normalizeTweetStatusUrl,
  resolveTweetCardFromUrl,
  resolveTweetCardFromUrlWithOptions,
} from '../../../../src/services/social/twitterOEmbed';

describe('services/social/twitterOEmbed', () => {
  beforeEach(() => {
    fetchMocks.fetch.mockReset();

    Object.assign(mockedEnv, {
      I18N: 'en',
      MEDIA_DOWNLOAD_TIMEOUT_MS: 5000,
      TWITTER_OEMBED_ENDPOINT: 'https://publish.twitter.com/oembed',
    });

    global.env = mockedEnv as any;
  });

  describe('normalizeTweetStatusUrl', () => {
    it('normalizes a twitter.com status URL to x.com canonical form', () => {
      const result = normalizeTweetStatusUrl('https://twitter.com/user123/status/9876543210');
      expect(result).toBe('https://x.com/user123/status/9876543210');
    });

    it('normalizes an x.com status URL unchanged', () => {
      const result = normalizeTweetStatusUrl('https://x.com/handle/status/1234567890');
      expect(result).toBe('https://x.com/handle/status/1234567890');
    });

    it('returns null for a non-Twitter URL', () => {
      expect(normalizeTweetStatusUrl('https://example.com/user/status/123')).toBeNull();
    });

    it('returns null for an empty or whitespace input', () => {
      expect(normalizeTweetStatusUrl('')).toBeNull();
      expect(normalizeTweetStatusUrl('   ')).toBeNull();
    });

    it('extracts a tweet URL embedded in surrounding text', () => {
      const result = normalizeTweetStatusUrl('Check this out: https://twitter.com/abc/status/555 cool!');
      expect(result).toBe('https://x.com/abc/status/555');
    });
  });

  describe('resolveTweetCardFromUrl', () => {
    it('returns a TweetCardPayload with sanitized HTML on success', async () => {
      fetchMocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          html: '<blockquote>Tweet content</blockquote><script>bad()</script>',
          author_name: 'Test User',
          author_url: 'https://x.com/testuser',
        }),
      });

      const result = await resolveTweetCardFromUrl('https://x.com/testuser/status/123');

      expect(result).not.toBeNull();
      expect(result?.html).not.toContain('<script>');
      expect(result?.html).toContain('Tweet content');
      expect(result?.authorName).toBe('Test User');
      expect(result?.url).toBe('https://x.com/testuser/status/123');
    });

    it('returns null for a null or undefined input', async () => {
      expect(await resolveTweetCardFromUrl(null)).toBeNull();
      expect(await resolveTweetCardFromUrl(undefined)).toBeNull();
    });

    it('returns null for a non-tweet URL', async () => {
      const result = await resolveTweetCardFromUrl('https://example.com/not/a/tweet');
      expect(result).toBeNull();
      expect(fetchMocks.fetch).not.toHaveBeenCalled();
    });

    it('throws MediaIngestionError when the oEmbed response is not ok', async () => {
      fetchMocks.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        resolveTweetCardFromUrl('https://x.com/user/status/999'),
      ).rejects.toThrow();
    });

    it('throws MediaIngestionError when oEmbed HTML payload is empty after sanitization', async () => {
      fetchMocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          html: '<script>evil()</script>',
          author_name: 'Bot',
        }),
      });

      await expect(
        resolveTweetCardFromUrl('https://x.com/bot/status/777'),
      ).rejects.toThrow();
    });
  });

  describe('resolveTweetCardFromUrlWithOptions', () => {
    it('passes hide_media=true when the option is set', async () => {
      fetchMocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          html: '<blockquote>Content</blockquote>',
          author_name: 'Author',
        }),
      });

      await resolveTweetCardFromUrlWithOptions('https://x.com/user/status/123', { hideMedia: true });

      const calledUrl: string = fetchMocks.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('hide_media=true');
    });
  });
});
