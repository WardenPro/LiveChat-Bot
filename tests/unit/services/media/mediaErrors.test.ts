import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedEnv = vi.hoisted(() => {
  return {
    API_URL: 'http://localhost:3000',
    DATABASE_URL: 'file:./sqlite.db',
    DISCORD_CLIENT_ID: 'discord-client-id',
    DISCORD_TOKEN: 'discord-token',
    MEDIA_MAX_SIZE_MB: 32,
    MEDIA_CACHE_MAX_TOTAL_MB: 900,
    MEDIA_BOARD_MAX_TOTAL_MB: 1200,
  };
});

vi.mock('../../../../src/services/env', () => {
  return {
    env: mockedEnv,
  };
});

import {
  MediaIngestionError,
  getLocalizedMediaErrorMessage,
  getMediaErrorCodeFromHttpStatus,
  pickMostRelevantMediaError,
  toMediaIngestionError,
} from '../../../../src/services/media/mediaErrors';
import { createMediaEnvFixture } from './mediaTestFixture';

describe('services/media/mediaErrors', () => {
  const translateSpy = vi.fn((key: string, params?: Record<string, unknown>) => {
    return params ? `${key}:${JSON.stringify(params)}` : key;
  });

  beforeEach(() => {
    Object.assign(
      mockedEnv,
      createMediaEnvFixture({
        MEDIA_MAX_SIZE_MB: 32,
        MEDIA_CACHE_MAX_TOTAL_MB: 900,
        MEDIA_BOARD_MAX_TOTAL_MB: 1200,
      }),
    );

    global.rosetty = {
      t: translateSpy,
    } as any;

    translateSpy.mockClear();
  });

  it('maps HTTP status codes to media ingestion error codes', () => {
    expect(getMediaErrorCodeFromHttpStatus(401)).toBe('PRIVATE_OR_AUTH_REQUIRED');
    expect(getMediaErrorCodeFromHttpStatus(404)).toBe('MEDIA_NOT_FOUND');
    expect(getMediaErrorCodeFromHttpStatus(504)).toBe('DOWNLOAD_TIMEOUT');
    expect(getMediaErrorCodeFromHttpStatus(413)).toBe('FILE_TOO_LARGE');
    expect(getMediaErrorCodeFromHttpStatus(502)).toBe('DOWNLOAD_FAILED');
  });

  it('normalizes unknown failures into typed media ingestion errors', () => {
    const unsupported = toMediaIngestionError(new Error('Unsupported URL for this extractor'), 'DOWNLOAD_FAILED');
    const timeout = toMediaIngestionError(
      {
        stderr: 'Response status: 504 gateway timeout',
      },
      'DOWNLOAD_FAILED',
    );

    expect(unsupported).toBeInstanceOf(MediaIngestionError);
    expect(unsupported.code).toBe('UNSUPPORTED_SOURCE');
    expect(timeout.code).toBe('DOWNLOAD_TIMEOUT');
  });

  it('returns existing media errors without wrapping', () => {
    const existing = new MediaIngestionError('INVALID_MEDIA', 'Invalid media payload');

    expect(toMediaIngestionError(existing)).toBe(existing);
  });

  it('picks the highest-priority media error when multiple failures exist', () => {
    const lowerPriority = new MediaIngestionError('DOWNLOAD_FAILED', 'Download failed');
    const higherPriority = new MediaIngestionError('DRM_PROTECTED', 'DRM protected');

    const selected = pickMostRelevantMediaError(lowerPriority, higherPriority);

    expect(selected.code).toBe('DRM_PROTECTED');
  });

  it('localizes media errors with runtime limits for user-facing messages', () => {
    const fileTooLarge = getLocalizedMediaErrorMessage(new MediaIngestionError('FILE_TOO_LARGE', 'too large'));
    const cacheLimit = getLocalizedMediaErrorMessage(
      new MediaIngestionError('CACHE_STORAGE_LIMIT_REACHED', 'cache limit reached'),
    );
    const boardLimit = getLocalizedMediaErrorMessage(
      new MediaIngestionError('BOARD_STORAGE_LIMIT_REACHED', 'board limit reached'),
    );

    expect(fileTooLarge).toContain('sendCommandMediaErrorTooLarge');
    expect(cacheLimit).toContain('sendCommandMediaErrorCacheStorageLimit');
    expect(boardLimit).toContain('sendCommandMediaErrorBoardStorageLimit');

    expect(translateSpy).toHaveBeenCalledWith('sendCommandMediaErrorTooLarge', {
      maxSizeMb: 32,
    });
    expect(translateSpy).toHaveBeenCalledWith('sendCommandMediaErrorCacheStorageLimit', {
      maxCacheTotalMb: 900,
    });
    expect(translateSpy).toHaveBeenCalledWith('sendCommandMediaErrorBoardStorageLimit', {
      maxBoardTotalMb: 1200,
    });
  });
});
