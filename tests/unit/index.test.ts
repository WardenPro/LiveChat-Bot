import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const indexMocks = vi.hoisted(() => {
  return {
    env: {
      PORT: 4321,
      LOG: 'debug',
    } as Record<string, unknown>,
    runServer: vi.fn(),
    listen: vi.fn(),
  };
});

vi.mock('../../src/server', () => {
  return {
    runServer: indexMocks.runServer,
  };
});

vi.mock('../../src/services/env', () => {
  return {
    env: indexMocks.env,
  };
});

const loadIndexModule = async () => {
  vi.resetModules();
  await import('../../src/index');
};

describe('index bootstrap', () => {
  const originalEnv = process.env;
  let processOnSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let handlers: Record<string, (...args: unknown[]) => unknown>;

  beforeEach(() => {
    handlers = {};
    indexMocks.listen.mockReset();
    indexMocks.runServer.mockReset();
    indexMocks.runServer.mockResolvedValue({
      listen: indexMocks.listen,
    });
    indexMocks.listen.mockResolvedValue(undefined);

    global.logger = {
      fatal: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(),
      level: 'info',
      silent: false,
    } as any;
    global.env = {} as any;

    processOnSpy = vi.spyOn(process, 'on').mockImplementation(((eventName: string, handler: (...args: unknown[]) => unknown) => {
      handlers[eventName] = handler;
      return process as NodeJS.Process;
    }) as any);

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      return code as never;
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('loads env, runs server, and listens on configured port', async () => {
    await loadIndexModule();

    await vi.waitFor(() => {
      expect(indexMocks.runServer).toHaveBeenCalledTimes(1);
      expect(indexMocks.listen).toHaveBeenCalledTimes(1);
    });

    expect(indexMocks.listen).toHaveBeenCalledWith({
      port: 4321,
      host: '::',
      listenTextResolver: expect.any(Function),
    });

    const listenTextResolver = indexMocks.listen.mock.calls[0][0].listenTextResolver as (address: string) => string;
    expect(listenTextResolver('http://[::]:4321')).toBe('[SERVER] Listening on http://[::]:4321');
    expect(global.env).toBe(indexMocks.env);
    expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('logs invalid environment boot errors and exits with code 1', async () => {
    const invalidEnvError = {
      invalidKeys: ['API_URL', 'DISCORD_TOKEN'],
    };
    indexMocks.runServer.mockRejectedValueOnce(invalidEnvError);

    await loadIndexModule();

    await vi.waitFor(() => {
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    expect((global.logger.fatal as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(
      '[BOOT] Invalid environment configuration: API_URL, DISCORD_TOKEN',
    );
  });

  it('handles uncaught exceptions via registered process hook', async () => {
    await loadIndexModule();

    const uncaughtExceptionHandler = handlers.uncaughtException;
    if (!uncaughtExceptionHandler) {
      throw new Error('Expected uncaughtException handler to be registered');
    }

    const boom = new Error('uncaught-boom');
    uncaughtExceptionHandler(boom);

    expect(global.logger.fatal).toHaveBeenCalledWith({ err: boom }, '[BOOT] Uncaught exception');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
