import assert from 'assert';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface CharacterizationSuiteResult {
  name: string;
  artifact: Record<string, unknown>;
}

const baseEnv = {
  NODE_ENV: 'test',
  LOG: 'silent',
  PORT: 3333,
  I18N: 'en',
  API_URL: 'http://localhost:3333',
  ADMIN_UI_TOKEN: '',
  ADMIN_UI_LOCAL_ONLY: true,
  DISCORD_TOKEN: 'test-token',
  DISCORD_CLIENT_ID: 'test-client-id',
  INGEST_API_TOKEN: '',
  DATABASE_URL: 'file:./sqlite.db',
  HIDE_COMMANDS_DISABLED: 'false',
  DEFAULT_DURATION: 5,
  PLAYBACK_JOB_RETENTION_HOURS: 72,
  MEDIA_STORAGE_DIR: './data/media',
  MEDIA_CACHE_TTL_HOURS: 12,
  MEDIA_CACHE_MAX_TOTAL_MB: 1024,
  MEDIA_BOARD_MAX_TOTAL_MB: 1024,
  MEDIA_DOWNLOAD_TIMEOUT_MS: 180000,
  MEDIA_MAX_SIZE_MB: 2048,
  MEDIA_VIDEO_MAX_HEIGHT: 1080,
  MEDIA_VIDEO_ENCODER: 'auto',
  MEDIA_VIDEO_NVENC_PRESET: 'p4',
  MEDIA_VIDEO_PRESET: 'ultrafast',
  MEDIA_AUDIO_NORMALIZE_ENABLED: true,
  MEDIA_AUDIO_LOUDNORM_I: -18,
  MEDIA_AUDIO_LOUDNORM_LRA: 11,
  MEDIA_AUDIO_LOUDNORM_TP: -1.5,
  TWITTER_OEMBED_ENDPOINT: 'https://publish.twitter.com/oembed',
  TWITTER_VIDEO_RESOLVER_BASE_URL: 'https://vxtwitter.com',
  TWITTER_CARD_DURATION_SEC: 15,
  PAIRING_CODE_TTL_MINUTES: 5,
  YTDLP_BINARY: 'yt-dlp',
  YTDLP_CONCURRENT_FRAGMENTS: 1,
  YTDLP_FORMAT:
    'bv*[vcodec^=avc1][ext=mp4][height<=1080]+ba[ext=m4a]/b[vcodec^=avc1][ext=mp4][height<=1080]/bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4][height<=1080]/bv*[height<=1080]+ba/b[height<=1080]/best',
  TIKTOK_COOKIE: '',
  FFMPEG_BINARY: 'ffmpeg',
  FFPROBE_BINARY: 'ffprobe',
};

export const ensureCharacterizationGlobals = (envOverrides?: Record<string, unknown>) => {
  global.logger = {
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
    child: () => global.logger,
  } as any;

  global.env = {
    ...baseEnv,
    ...(envOverrides || {}),
  } as any;

  global.rosetty = {
    t: (key: string) => {
      if (key === 'error') {
        return 'Error';
      }

      if (key === 'commandError') {
        return 'Command failed';
      }

      return key;
    },
  } as any;

  global.commandsLoaded = [];
};

export const toValueShape = (value: unknown): unknown => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }

    return value.map((entry) => toValueShape(entry));
  }

  if (value instanceof Date) {
    return 'date';
  }

  const valueType = typeof value;

  if (valueType !== 'object') {
    return valueType;
  }

  const record = value as Record<string, unknown>;
  const sortedEntries = Object.entries(record).sort(([left], [right]) => left.localeCompare(right));

  return sortedEntries.reduce<Record<string, unknown>>((accumulator, [key, entryValue]) => {
    accumulator[key] = toValueShape(entryValue);
    return accumulator;
  }, {});
};

const BASELINE_DIRECTORY = path.resolve(__dirname, 'baselines');
const LATEST_DIRECTORY = path.resolve(process.cwd(), '.ralph', 'characterization', 'latest');

export const writeLatestArtifact = async (suiteName: string, artifact: Record<string, unknown>) => {
  await mkdir(LATEST_DIRECTORY, { recursive: true });
  const artifactPath = path.join(LATEST_DIRECTORY, `${suiteName}.latest.json`);
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
};

export const assertOrUpdateBaseline = async (params: {
  suiteName: string;
  artifact: Record<string, unknown>;
  updateBaseline: boolean;
}) => {
  await mkdir(BASELINE_DIRECTORY, { recursive: true });

  const baselinePath = path.join(BASELINE_DIRECTORY, `${params.suiteName}.baseline.json`);

  if (params.updateBaseline) {
    await writeFile(baselinePath, `${JSON.stringify(params.artifact, null, 2)}\n`, 'utf8');
    return;
  }

  const baselineRaw = await readFile(baselinePath, 'utf8');
  const baseline = JSON.parse(baselineRaw) as Record<string, unknown>;

  assert.deepStrictEqual(
    params.artifact,
    baseline,
    `Characterization baseline mismatch for suite \"${params.suiteName}\"`,
  );
};
