import { describe, expect, it } from 'vitest';

import { buildMediaOverlayTextPayload, decodeRichOverlayPayload } from '../../../../src/services/messages/richOverlayPayload';

describe('richOverlayPayload', () => {
  it('encodes and decodes media payloads with start offsets', () => {
    const encoded = buildMediaOverlayTextPayload({
      text: '  Clip title  ',
      startOffsetSec: 12.9,
    });

    const decoded = decodeRichOverlayPayload(encoded);

    expect(decoded).toEqual({
      type: 'media',
      caption: 'Clip title',
      startOffsetSec: 12,
    });
  });

  it('returns null for invalid encoded payloads', () => {
    expect(decodeRichOverlayPayload('__LC_OVERLAY_RICH__::not-json')).toBeNull();
  });
});
