import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaIngestionError } from '../../../../src/services/media/mediaErrors';
import { createMediaEnvFixture } from './mediaTestFixture';

const mockedEnvFromModule = vi.hoisted(() => {
  return {
    API_URL: 'http://localhost:3000',
    DATABASE_URL: 'file:./sqlite.db',
    DISCORD_CLIENT_ID: 'discord-client-id',
    DISCORD_TOKEN: 'discord-token',
    MEDIA_MAX_SIZE_MB: 25,
    MEDIA_CACHE_MAX_TOTAL_MB: 512,
    MEDIA_BOARD_MAX_TOTAL_MB: 512,
  };
});

vi.mock('../../../../src/services/env', () => {
  return {
    env: mockedEnvFromModule,
  };
});

const mocks = vi.hoisted(() => {
  return {
    execFile: vi.fn(),
    copyFile: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    fileTypeFromFile: vi.fn(),
  };
});

vi.mock('child_process', () => {
  return {
    execFile: mocks.execFile,
  };
});

vi.mock('fs/promises', () => {
  return {
    copyFile: mocks.copyFile,
    rm: mocks.rm,
    stat: mocks.stat,
  };
});

vi.mock('file-type', () => {
  return {
    fileTypeFromFile: mocks.fileTypeFromFile,
  };
});

import { normalizeDownloadedMedia } from '../../../../src/services/media/mediaTranscode';

type ExecCallback = (error: Error | null, result?: { stdout?: string; stderr?: string }) => void;

describe('services/media/mediaTranscode', () => {
  beforeEach(() => {
    global.env = createMediaEnvFixture({
      MEDIA_AUDIO_NORMALIZE_ENABLED: false,
      MEDIA_VIDEO_ENCODER: 'auto',
      MEDIA_VIDEO_MAX_HEIGHT: 1080,
      FFMPEG_BINARY: 'ffmpeg',
      FFPROBE_BINARY: 'ffprobe',
      MEDIA_DOWNLOAD_TIMEOUT_MS: 3000,
    }) as any;

    global.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    mocks.execFile.mockReset();
    mocks.copyFile.mockReset();
    mocks.rm.mockReset();
    mocks.stat.mockReset();
    mocks.fileTypeFromFile.mockReset();

    mocks.copyFile.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
    mocks.stat.mockResolvedValue({
      size: 4096,
    });
  });

  it('copies compatible MP4 video without running ffmpeg transcode', async () => {
    mocks.fileTypeFromFile.mockResolvedValue({
      mime: 'video/mp4',
    });

    mocks.execFile.mockImplementation(
      (binary: string, args: string[], _options: Record<string, unknown>, callback: ExecCallback) => {
        if (binary !== 'ffprobe') {
          callback(new Error('ffmpeg should not run for direct copy'));
          return;
        }

        const targetPath = args[args.length - 1];

        if (targetPath === '/tmp/input.mp4') {
          callback(null, {
            stdout: JSON.stringify({
              streams: [
                {
                  codec_type: 'video',
                  codec_name: 'h264',
                  width: 1280,
                  height: 720,
                  pix_fmt: 'yuv420p',
                },
                {
                  codec_type: 'audio',
                  codec_name: 'aac',
                },
              ],
              format: {
                duration: '12.2',
                format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
              },
            }),
          });
          return;
        }

        callback(null, {
          stdout: JSON.stringify({
            streams: [
              {
                codec_type: 'video',
                codec_name: 'h264',
                width: 1280,
                height: 720,
                pix_fmt: 'yuv420p',
              },
            ],
            format: {
              duration: '12.2',
              format_name: 'mp4',
            },
          }),
        });
      },
    );

    const result = await normalizeDownloadedMedia('/tmp/input.mp4', '/tmp/cache/asset');

    expect(result).toMatchObject({
      kind: 'video',
      mime: 'video/mp4',
      storagePath: '/tmp/cache/asset.mp4',
      durationSec: 13,
    });
    expect(mocks.copyFile).toHaveBeenCalledWith('/tmp/input.mp4', '/tmp/cache/asset.mp4');

    const ffmpegCalls = mocks.execFile.mock.calls.filter(([binary]) => binary === 'ffmpeg');
    expect(ffmpegCalls).toHaveLength(0);
  });

  it('normalizes audio-only media inside a video container to MP3', async () => {
    mocks.fileTypeFromFile.mockResolvedValue({
      mime: 'video/mp4',
    });

    mocks.execFile.mockImplementation(
      (binary: string, args: string[], _options: Record<string, unknown>, callback: ExecCallback) => {
        if (binary === 'ffprobe') {
          const targetPath = args[args.length - 1];

          if (targetPath === '/tmp/input-no-video.mp4') {
            callback(null, {
              stdout: JSON.stringify({
                streams: [
                  {
                    codec_type: 'audio',
                    codec_name: 'aac',
                  },
                ],
                format: {
                  duration: '5.0',
                  format_name: 'mp4',
                },
              }),
            });
            return;
          }

          callback(null, {
            stdout: JSON.stringify({
              streams: [
                {
                  codec_type: 'audio',
                  codec_name: 'mp3',
                },
              ],
              format: {
                duration: '5.0',
                format_name: 'mp3',
              },
            }),
          });
          return;
        }

        callback(null, {
          stdout: '',
          stderr: '',
        });
      },
    );

    const result = await normalizeDownloadedMedia('/tmp/input-no-video.mp4', '/tmp/cache/audio-only');

    expect(result).toMatchObject({
      kind: 'audio',
      mime: 'audio/mpeg',
      storagePath: '/tmp/cache/audio-only.mp3',
      durationSec: 5,
    });

    const ffmpegCall = mocks.execFile.mock.calls.find(([binary]) => binary === 'ffmpeg');
    expect(ffmpegCall).toBeDefined();
    expect(ffmpegCall?.[1]).toEqual(expect.arrayContaining(['-vn', '-acodec', 'libmp3lame']));
  });

  it('throws INVALID_MEDIA when normalized output is effectively empty', async () => {
    mocks.fileTypeFromFile.mockResolvedValue({
      mime: 'image/png',
    });
    mocks.stat.mockResolvedValue({
      size: 100,
    });

    mocks.execFile.mockImplementation(
      (_binary: string, _args: string[], _options: Record<string, unknown>, callback: ExecCallback) => {
        callback(new Error('ffprobe unavailable'));
      },
    );

    await expect(normalizeDownloadedMedia('/tmp/image.png', '/tmp/cache/image')).rejects.toMatchObject({
      code: 'INVALID_MEDIA',
      message: 'Normalized media output is empty',
    });

    await expect(normalizeDownloadedMedia('/tmp/image.png', '/tmp/cache/image')).rejects.toBeInstanceOf(MediaIngestionError);
  });
});
