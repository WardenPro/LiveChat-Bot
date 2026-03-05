import assert from 'assert';
import { spawnSync } from 'child_process';

interface EnvSnapshot {
  NODE_ENV: string;
  LOG: string;
  PORT: number;
  I18N: string;
  API_URL: string;
  ADMIN_UI_TOKEN: string;
  ADMIN_UI_LOCAL_ONLY: boolean;
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  INGEST_API_TOKEN: string;
  DATABASE_URL: string;
  HIDE_COMMANDS_DISABLED: string;
  DEFAULT_DURATION: number;
  PLAYBACK_JOB_RETENTION_HOURS: number;
  MEDIA_STORAGE_DIR: string;
  MEDIA_CACHE_TTL_HOURS: number;
  MEDIA_CACHE_MAX_TOTAL_MB: number;
  MEDIA_BOARD_MAX_TOTAL_MB: number;
  MEDIA_DOWNLOAD_TIMEOUT_MS: number;
  MEDIA_MAX_SIZE_MB: number;
  MEDIA_VIDEO_MAX_HEIGHT: number;
  MEDIA_VIDEO_ENCODER: string;
  MEDIA_VIDEO_NVENC_PRESET: string;
  MEDIA_VIDEO_PRESET: string;
  MEDIA_AUDIO_NORMALIZE_ENABLED: boolean;
  MEDIA_AUDIO_LOUDNORM_I: number;
  MEDIA_AUDIO_LOUDNORM_LRA: number;
  MEDIA_AUDIO_LOUDNORM_TP: number;
  TWITTER_OEMBED_ENDPOINT: string;
  TWITTER_VIDEO_RESOLVER_BASE_URL: string;
  TWITTER_CARD_DURATION_SEC: number;
  PAIRING_CODE_TTL_MINUTES: number;
  YTDLP_BINARY: string;
  YTDLP_CONCURRENT_FRAGMENTS: number;
  YTDLP_FORMAT: string;
  TIKTOK_COOKIE: string;
  FFMPEG_BINARY: string;
  FFPROBE_BINARY: string;
}

const ENV_SNAPSHOT_SCRIPT = `
const { env } = require('./src/services/env.ts');
const snapshot = {
  NODE_ENV: env.NODE_ENV,
  LOG: env.LOG,
  PORT: env.PORT,
  I18N: env.I18N,
  API_URL: env.API_URL,
  ADMIN_UI_TOKEN: env.ADMIN_UI_TOKEN,
  ADMIN_UI_LOCAL_ONLY: env.ADMIN_UI_LOCAL_ONLY,
  DISCORD_TOKEN: env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
  INGEST_API_TOKEN: env.INGEST_API_TOKEN,
  DATABASE_URL: env.DATABASE_URL,
  HIDE_COMMANDS_DISABLED: env.HIDE_COMMANDS_DISABLED,
  DEFAULT_DURATION: env.DEFAULT_DURATION,
  PLAYBACK_JOB_RETENTION_HOURS: env.PLAYBACK_JOB_RETENTION_HOURS,
  MEDIA_STORAGE_DIR: env.MEDIA_STORAGE_DIR,
  MEDIA_CACHE_TTL_HOURS: env.MEDIA_CACHE_TTL_HOURS,
  MEDIA_CACHE_MAX_TOTAL_MB: env.MEDIA_CACHE_MAX_TOTAL_MB,
  MEDIA_BOARD_MAX_TOTAL_MB: env.MEDIA_BOARD_MAX_TOTAL_MB,
  MEDIA_DOWNLOAD_TIMEOUT_MS: env.MEDIA_DOWNLOAD_TIMEOUT_MS,
  MEDIA_MAX_SIZE_MB: env.MEDIA_MAX_SIZE_MB,
  MEDIA_VIDEO_MAX_HEIGHT: env.MEDIA_VIDEO_MAX_HEIGHT,
  MEDIA_VIDEO_ENCODER: env.MEDIA_VIDEO_ENCODER,
  MEDIA_VIDEO_NVENC_PRESET: env.MEDIA_VIDEO_NVENC_PRESET,
  MEDIA_VIDEO_PRESET: env.MEDIA_VIDEO_PRESET,
  MEDIA_AUDIO_NORMALIZE_ENABLED: env.MEDIA_AUDIO_NORMALIZE_ENABLED,
  MEDIA_AUDIO_LOUDNORM_I: env.MEDIA_AUDIO_LOUDNORM_I,
  MEDIA_AUDIO_LOUDNORM_LRA: env.MEDIA_AUDIO_LOUDNORM_LRA,
  MEDIA_AUDIO_LOUDNORM_TP: env.MEDIA_AUDIO_LOUDNORM_TP,
  TWITTER_OEMBED_ENDPOINT: env.TWITTER_OEMBED_ENDPOINT,
  TWITTER_VIDEO_RESOLVER_BASE_URL: env.TWITTER_VIDEO_RESOLVER_BASE_URL,
  TWITTER_CARD_DURATION_SEC: env.TWITTER_CARD_DURATION_SEC,
  PAIRING_CODE_TTL_MINUTES: env.PAIRING_CODE_TTL_MINUTES,
  YTDLP_BINARY: env.YTDLP_BINARY,
  YTDLP_CONCURRENT_FRAGMENTS: env.YTDLP_CONCURRENT_FRAGMENTS,
  YTDLP_FORMAT: env.YTDLP_FORMAT,
  TIKTOK_COOKIE: env.TIKTOK_COOKIE,
  FFMPEG_BINARY: env.FFMPEG_BINARY,
  FFPROBE_BINARY: env.FFPROBE_BINARY,
};
process.stdout.write(JSON.stringify(snapshot));
`;

const runEnvSnapshot = (runtimeEnv: NodeJS.ProcessEnv): EnvSnapshot => {
  const execution = spawnSync('pnpm', ['tsx', '-e', ENV_SNAPSHOT_SCRIPT], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...runtimeEnv,
    },
    encoding: 'utf8',
  });

  assert.strictEqual(
    execution.status,
    0,
    `env snapshot command failed: ${execution.stderr || execution.stdout || 'unknown error'}`,
  );

  const output = execution.stdout.trim();
  assert(output.length > 0, 'env snapshot command should emit output');

  const outputLines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  assert(outputLines.length > 0, 'env snapshot command should emit JSON output');

  return JSON.parse(outputLines[outputLines.length - 1]) as EnvSnapshot;
};

interface FailedCommandResult {
  exitCode: number;
  output: string;
}

const runFailedEnvCommand = (runtimeEnv: NodeJS.ProcessEnv): FailedCommandResult => {
  const execution = spawnSync('pnpm', ['tsx', '-e', ENV_SNAPSHOT_SCRIPT], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...runtimeEnv,
    },
    encoding: 'utf8',
  });

  const exitCode = execution.status ?? -1;
  const output = `${execution.stdout || ''}\n${execution.stderr || ''}`.trim();

  assert.notStrictEqual(exitCode, 0, 'invalid environment configuration should fail deterministically');

  return {
    exitCode,
    output,
  };
};

export const runEnvParsingCharacterization = async () => {
  const productionLikeEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    LOG: 'warning',
    API_URL: 'https://api.livechat.example',
    ADMIN_UI_TOKEN: 'admin-ui-token',
    ADMIN_UI_LOCAL_ONLY: 'false',
    DISCORD_TOKEN: 'discord-production-token',
    DISCORD_CLIENT_ID: 'discord-client-id',
    INGEST_API_TOKEN: 'legacy-ingest-token',
    DATABASE_URL: 'file:./sqlite.db',
    HIDE_COMMANDS_DISABLED: 'false',
    DEFAULT_DURATION: '7',
    PLAYBACK_JOB_RETENTION_HOURS: '96',
    MEDIA_STORAGE_DIR: './data/custom-media',
    MEDIA_CACHE_TTL_HOURS: '24',
    MEDIA_CACHE_MAX_TOTAL_MB: '2048',
    MEDIA_BOARD_MAX_TOTAL_MB: '4096',
    MEDIA_DOWNLOAD_TIMEOUT_MS: '120000',
    MEDIA_MAX_SIZE_MB: '1024',
    MEDIA_VIDEO_MAX_HEIGHT: '720',
    MEDIA_VIDEO_ENCODER: 'libx264',
    MEDIA_VIDEO_NVENC_PRESET: 'p5',
    MEDIA_VIDEO_PRESET: 'medium',
    MEDIA_AUDIO_NORMALIZE_ENABLED: 'false',
    MEDIA_AUDIO_LOUDNORM_I: '-16',
    MEDIA_AUDIO_LOUDNORM_LRA: '9',
    MEDIA_AUDIO_LOUDNORM_TP: '-1',
    TWITTER_OEMBED_ENDPOINT: 'https://publish.twitter.com/oembed',
    TWITTER_VIDEO_RESOLVER_BASE_URL: 'https://vxtwitter.com',
    TWITTER_CARD_DURATION_SEC: '20',
    PAIRING_CODE_TTL_MINUTES: '10',
    YTDLP_BINARY: '/usr/local/bin/yt-dlp',
    YTDLP_CONCURRENT_FRAGMENTS: '4',
    YTDLP_FORMAT: 'bestvideo+bestaudio',
    TIKTOK_COOKIE: 'ttwid=sample; sessionid=sample',
    FFMPEG_BINARY: '/usr/local/bin/ffmpeg',
    FFPROBE_BINARY: '/usr/local/bin/ffprobe',
  };

  const productionLikeSnapshot = runEnvSnapshot(productionLikeEnv);
  const invalidPortFailure = runFailedEnvCommand({
    ...productionLikeEnv,
    PORT: 'not-a-number',
  });

  assert.strictEqual(productionLikeSnapshot.NODE_ENV, 'production');
  assert.strictEqual(productionLikeSnapshot.ADMIN_UI_LOCAL_ONLY, false);
  assert.strictEqual(productionLikeSnapshot.MEDIA_AUDIO_NORMALIZE_ENABLED, false);
  assert.strictEqual(
    invalidPortFailure.output.includes('Invalid environment configuration'),
    true,
    'invalid environment startup should emit a deterministic configuration error',
  );
  assert.strictEqual(
    invalidPortFailure.output.includes('PORT'),
    true,
    'invalid environment error should expose key only',
  );
  assert.strictEqual(
    invalidPortFailure.output.includes('not-a-number'),
    false,
    'invalid environment error should avoid logging raw invalid values',
  );

  return {
    productionLikeSnapshot,
    invalidPortFailure: {
      exitCode: invalidPortFailure.exitCode,
      deterministicMessage: invalidPortFailure.output.includes('Invalid environment configuration'),
      mentionsInvalidKey: invalidPortFailure.output.includes('PORT'),
      leaksRawValue: invalidPortFailure.output.includes('not-a-number'),
    },
  };
};
