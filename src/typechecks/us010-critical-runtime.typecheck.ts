import type { CreateIngestClientTokenParams } from '../services/ingestAuth';
import type { OverlayAuthResolution } from '../services/overlayAuth';

const validIngestClientParams: CreateIngestClientTokenParams = {
  guildId: 'guild-1',
  label: 'Ingest Device',
  defaultAuthorName: 'Alice',
  defaultAuthorImage: null,
  createdByDiscordUserId: 'discord-user-1',
};

void validIngestClientParams;

// @ts-expect-error createdByDiscordUserId is required for ingest client contracts
const missingRequiredCreatedBy: CreateIngestClientTokenParams = {
  guildId: 'guild-1',
  label: 'Ingest Device',
  defaultAuthorName: 'Alice',
  defaultAuthorImage: null,
};

void missingRequiredCreatedBy;

const consumeOverlayAuthResolution = (resolution: OverlayAuthResolution): string => {
  if (resolution.kind === 'authenticated') {
    const guildId: string = resolution.client.guildId;
    const tokenSource = resolution.tokenSource;
    return `${guildId}:${tokenSource}`;
  }

  if (resolution.kind === 'invalid_token') {
    return resolution.tokenSource;
  }

  const missingKind: 'missing_token' = resolution.kind;
  return missingKind;
};

void consumeOverlayAuthResolution;
