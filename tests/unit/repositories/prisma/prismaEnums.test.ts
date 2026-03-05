import { describe, expect, it } from 'vitest';

import {
  MediaAssetKind,
  MediaAssetStatus,
  PlaybackJobStatus,
} from '../../../../src/repositories/prisma/prismaEnums';

describe('repositories/prisma/prismaEnums', () => {
  it('exposes stable enum-like values for media and playback states', () => {
    expect(MediaAssetKind).toEqual({
      IMAGE: 'IMAGE',
      AUDIO: 'AUDIO',
      VIDEO: 'VIDEO',
    });
    expect(MediaAssetStatus).toEqual({
      PROCESSING: 'PROCESSING',
      READY: 'READY',
      FAILED: 'FAILED',
    });
    expect(PlaybackJobStatus).toEqual({
      PENDING: 'PENDING',
      PLAYING: 'PLAYING',
      DONE: 'DONE',
      FAILED: 'FAILED',
    });
  });

  it('does not expose unsupported enum members', () => {
    expect((MediaAssetKind as Record<string, string>).DOCUMENT).toBeUndefined();
    expect((PlaybackJobStatus as Record<string, string>).CANCELLED).toBeUndefined();
  });
});
