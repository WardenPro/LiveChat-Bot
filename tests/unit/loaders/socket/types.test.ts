import { describe, expectTypeOf, it } from 'vitest';

import type {
  OverlayPlaybackStateUpdate,
  OverlayPlaybackStopUpdate,
  OverlaySocketAuthContext,
} from '../../../../src/loaders/socket/types';

describe('loaders/socket/types', () => {
  it('keeps playback state updates constrained to supported states', () => {
    expectTypeOf<OverlayPlaybackStateUpdate['state']>().toEqualTypeOf<'playing' | 'paused' | 'ended'>();
  });

  it('does not include legacy auth session modes in socket auth context', () => {
    type UnsupportedSessionMode = Extract<OverlaySocketAuthContext['overlaySessionMode'], 'legacy'>;
    expectTypeOf<UnsupportedSessionMode>().toEqualTypeOf<never>();
  });

  it('requires stop updates to include a concrete job id string', () => {
    expectTypeOf<OverlayPlaybackStopUpdate['jobId']>().toEqualTypeOf<string>();
  });
});
