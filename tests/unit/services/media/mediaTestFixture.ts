export const createMediaEnvFixture = (overrides: Record<string, unknown> = {}) => {
  return {
    MEDIA_MAX_SIZE_MB: 25,
    MEDIA_CACHE_MAX_TOTAL_MB: 512,
    MEDIA_BOARD_MAX_TOTAL_MB: 512,
    MEDIA_CACHE_TTL_HOURS: 24,
    MEDIA_STORAGE_DIR: '/tmp/livechat-media-tests',
    MEDIA_DOWNLOAD_TIMEOUT_MS: 5000,
    MEDIA_AUDIO_NORMALIZE_ENABLED: false,
    MEDIA_AUDIO_LOUDNORM_I: -16,
    MEDIA_AUDIO_LOUDNORM_LRA: 11,
    MEDIA_AUDIO_LOUDNORM_TP: -1.5,
    MEDIA_VIDEO_MAX_HEIGHT: 1080,
    MEDIA_VIDEO_PRESET: 'ultrafast',
    MEDIA_VIDEO_NVENC_PRESET: 'p4',
    MEDIA_VIDEO_ENCODER: 'auto',
    FFMPEG_BINARY: 'ffmpeg',
    FFPROBE_BINARY: 'ffprobe',
    YTDLP_BINARY: 'yt-dlp',
    YTDLP_FORMAT: '',
    YTDLP_CONCURRENT_FRAGMENTS: 1,
    ...overrides,
  };
};
