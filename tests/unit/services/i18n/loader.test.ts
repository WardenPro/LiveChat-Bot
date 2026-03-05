import { beforeEach, describe, expect, it, vi } from 'vitest';

const rosettyMocks = vi.hoisted(() => {
  return {
    rosetty: vi.fn(),
    t: vi.fn(),
  };
});

vi.mock('rosetty', () => {
  return {
    rosetty: rosettyMocks.rosetty,
  };
});

vi.mock('date-fns/locale', () => {
  return {
    enGB: { code: 'en-GB' },
    fr: { code: 'fr' },
  };
});

vi.mock('../../../../src/services/i18n/en', () => {
  return {
    enLang: { i18nLoaded: 'Translations loaded' },
  };
});

vi.mock('../../../../src/services/i18n/fr', () => {
  return {
    frLang: { i18nLoaded: 'Traductions chargées' },
  };
});

import { loadRosetty } from '../../../../src/services/i18n/loader';

describe('services/i18n/loader', () => {
  beforeEach(() => {
    rosettyMocks.rosetty.mockReset();
    rosettyMocks.t.mockReset();

    global.logger = {
      info: vi.fn(),
    } as any;

    global.env = {
      I18N: 'en',
    } as any;
  });

  it('initializes rosetty with both language dictionaries and sets global', () => {
    rosettyMocks.t.mockReturnValue('Translations loaded');
    const mockRosetty = { t: rosettyMocks.t };
    rosettyMocks.rosetty.mockReturnValue(mockRosetty);

    loadRosetty();

    expect(rosettyMocks.rosetty).toHaveBeenCalledWith(
      expect.objectContaining({
        en: expect.objectContaining({ dict: expect.any(Object) }),
        fr: expect.objectContaining({ dict: expect.any(Object) }),
      }),
      'en',
    );
    expect(global.rosetty).toBe(mockRosetty);
    expect(global.logger.info).toHaveBeenCalledWith(expect.stringContaining('Translations loaded'));
  });

  it('uses the configured I18N locale when initializing rosetty', () => {
    global.env = { I18N: 'fr' } as any;
    rosettyMocks.t.mockReturnValue('Traductions chargées');
    const mockRosetty = { t: rosettyMocks.t };
    rosettyMocks.rosetty.mockReturnValue(mockRosetty);

    loadRosetty();

    expect(rosettyMocks.rosetty).toHaveBeenCalledWith(expect.any(Object), 'fr');
  });
});
