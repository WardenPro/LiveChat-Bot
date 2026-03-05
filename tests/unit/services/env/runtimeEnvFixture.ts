const REQUIRED_RUNTIME_ENV: NodeJS.ProcessEnv = {
  API_URL: 'https://api.livechat.example',
  DISCORD_TOKEN: 'discord-token',
  DISCORD_CLIENT_ID: 'discord-client-id',
  DATABASE_URL: 'file:./sqlite.db',
};

export const createRuntimeEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
  const runtimeEnv: NodeJS.ProcessEnv = {
    ...REQUIRED_RUNTIME_ENV,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      delete runtimeEnv[key];
      continue;
    }

    runtimeEnv[key] = value;
  }

  return runtimeEnv;
};
