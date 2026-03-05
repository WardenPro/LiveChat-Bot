import crypto from 'crypto';
import type { FastifyRequest } from 'fastify';

type OverlayClientSessionMode = 'NORMAL' | 'INVITE_READ_ONLY';

interface CreateOverlayClientTokenParams {
  guildId: string;
  label: string;
  sessionMode?: OverlayClientSessionMode | null;
  defaultAuthorName?: string | null;
  defaultAuthorImage?: string | null;
  createdByDiscordUserId?: string | null;
}

interface OverlayClientCreateData {
  guildId: string;
  label: string;
  tokenHash: string;
  sessionMode?: OverlayClientSessionMode;
  defaultAuthorName?: string;
  defaultAuthorImage?: string;
  createdByDiscordUserId?: string;
}

interface LegacyOverlayClientCreateData {
  guildId: string;
  label: string;
  tokenHash: string;
}

interface OverlayClientRawRecord {
  id: string;
  guildId: string;
  label: string;
  tokenHash: string;
  sessionMode?: unknown;
  defaultAuthorName?: unknown;
  defaultAuthorImage?: unknown;
  createdByDiscordUserId?: unknown;
  lastSeenAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

interface OverlayClientCreateArgs {
  data: OverlayClientCreateData | LegacyOverlayClientCreateData;
}

interface OverlayClientFindFirstArgs {
  where: {
    tokenHash: string;
    revokedAt: null;
  };
}

interface OverlayClientCreateDelegate {
  create(args: OverlayClientCreateArgs): Promise<OverlayClientRawRecord>;
}

interface OverlayClientLookupDelegate {
  findFirst(args: OverlayClientFindFirstArgs): Promise<OverlayClientRawRecord | null>;
}

export interface OverlayClientRecord {
  id: string;
  guildId: string;
  label: string;
  tokenHash: string;
  sessionMode: string;
  defaultAuthorName: string | null;
  defaultAuthorImage: string | null;
  createdByDiscordUserId: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export type OverlayAuthTokenSource = 'authorization_header' | 'query_string' | 'socket_handshake';

interface OverlayAuthMissingTokenResult {
  kind: 'missing_token';
}

interface OverlayAuthInvalidTokenResult {
  kind: 'invalid_token';
  tokenSource: OverlayAuthTokenSource;
}

interface OverlayAuthAuthenticatedResult {
  kind: 'authenticated';
  token: string;
  tokenSource: OverlayAuthTokenSource;
  client: OverlayClientRecord;
}

export type OverlayAuthResolution =
  | OverlayAuthMissingTokenResult
  | OverlayAuthInvalidTokenResult
  | OverlayAuthAuthenticatedResult;

const isOverlayClientCreateDelegate = (value: unknown): value is OverlayClientCreateDelegate => {
  return !!value && typeof value === 'object' && typeof Reflect.get(value, 'create') === 'function';
};

const isOverlayClientLookupDelegate = (value: unknown): value is OverlayClientLookupDelegate => {
  return !!value && typeof value === 'object' && typeof Reflect.get(value, 'findFirst') === 'function';
};

const getOverlayClientCreateDelegate = (): OverlayClientCreateDelegate => {
  const delegate = Reflect.get(prisma, 'overlayClient');

  if (!isOverlayClientCreateDelegate(delegate)) {
    throw new Error('overlay_client_model_unavailable');
  }

  return delegate;
};

const getOverlayClientLookupDelegate = (): OverlayClientLookupDelegate => {
  const delegate = Reflect.get(prisma, 'overlayClient');

  if (!isOverlayClientLookupDelegate(delegate)) {
    throw new Error('overlay_client_model_unavailable');
  }

  return delegate;
};

const normalizeOptionalNonEmptyString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeUnknownNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeSessionMode = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'NORMAL';
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : 'NORMAL';
};

const toOverlayClientRecord = (value: OverlayClientRawRecord): OverlayClientRecord => {
  return {
    id: value.id,
    guildId: value.guildId,
    label: value.label,
    tokenHash: value.tokenHash,
    sessionMode: normalizeSessionMode(value.sessionMode),
    defaultAuthorName: normalizeUnknownNonEmptyString(value.defaultAuthorName),
    defaultAuthorImage: normalizeUnknownNonEmptyString(value.defaultAuthorImage),
    createdByDiscordUserId: normalizeUnknownNonEmptyString(value.createdByDiscordUserId),
    lastSeenAt: value.lastSeenAt,
    createdAt: value.createdAt,
    revokedAt: value.revokedAt,
  };
};

const getUnknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== 'object') {
    return '';
  }

  const message = Reflect.get(error, 'message');
  return typeof message === 'string' ? message : '';
};

const getQueryTokenFromRequest = (request: FastifyRequest): string | null => {
  const query = request.query;

  if (!query || typeof query !== 'object') {
    return null;
  }

  const token = Reflect.get(query, 'token');
  return typeof token === 'string' && token.length > 0 ? token : null;
};

export const hashOverlayToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateOverlayToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const createOverlayClientToken = async (params: CreateOverlayClientTokenParams) => {
  const rawToken = generateOverlayToken();
  const tokenHash = hashOverlayToken(rawToken);
  const createData: OverlayClientCreateData = {
    guildId: params.guildId,
    label: params.label,
    tokenHash,
    sessionMode: params.sessionMode === 'INVITE_READ_ONLY' ? 'INVITE_READ_ONLY' : 'NORMAL',
  };

  const defaultAuthorName = normalizeOptionalNonEmptyString(params.defaultAuthorName);
  const defaultAuthorImage = normalizeOptionalNonEmptyString(params.defaultAuthorImage);
  const createdByDiscordUserId = normalizeOptionalNonEmptyString(params.createdByDiscordUserId);

  if (defaultAuthorName) {
    createData.defaultAuthorName = defaultAuthorName;
  }

  if (defaultAuthorImage) {
    createData.defaultAuthorImage = defaultAuthorImage;
  }

  if (createdByDiscordUserId) {
    createData.createdByDiscordUserId = createdByDiscordUserId;
  }

  let client: OverlayClientRecord;

  try {
    const createdClient = await getOverlayClientCreateDelegate().create({
      data: createData,
    });

    client = toOverlayClientRecord(createdClient);
  } catch (error) {
    const errorMessage = getUnknownErrorMessage(error);
    const hasAuthorMetadata =
      !!createData.defaultAuthorName ||
      !!createData.defaultAuthorImage ||
      !!createData.createdByDiscordUserId ||
      !!createData.sessionMode;
    const shouldRetryLegacyCreate = hasAuthorMetadata && errorMessage.includes('Unknown argument');

    if (!shouldRetryLegacyCreate) {
      throw error;
    }

    const legacyCreateData: LegacyOverlayClientCreateData = {
      guildId: params.guildId,
      label: params.label,
      tokenHash,
    };

    const createdClient = await getOverlayClientCreateDelegate().create({
      data: legacyCreateData,
    });

    client = toOverlayClientRecord(createdClient);
  }

  return {
    client,
    rawToken,
  };
};

export const getBearerTokenFromRequest = (request: FastifyRequest): string | null => {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

export const resolveOverlayAuthFromToken = async (
  token: string | null,
  tokenSource: OverlayAuthTokenSource,
): Promise<OverlayAuthResolution> => {
  if (!token) {
    return {
      kind: 'missing_token',
    };
  }

  const tokenHash = hashOverlayToken(token);

  const client = await getOverlayClientLookupDelegate().findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
  });

  if (!client) {
    return {
      kind: 'invalid_token',
      tokenSource,
    };
  }

  return {
    kind: 'authenticated',
    token,
    tokenSource,
    client: toOverlayClientRecord(client),
  };
};

export const resolveOverlayAuthFromRequest = async (request: FastifyRequest): Promise<OverlayAuthResolution> => {
  const bearerToken = getBearerTokenFromRequest(request);

  if (bearerToken) {
    return resolveOverlayAuthFromToken(bearerToken, 'authorization_header');
  }

  const queryToken = getQueryTokenFromRequest(request);

  if (queryToken) {
    return resolveOverlayAuthFromToken(queryToken, 'query_string');
  }

  return {
    kind: 'missing_token',
  };
};

export const resolveOverlayClientFromRequest = async (
  request: FastifyRequest,
): Promise<{ client: OverlayClientRecord; token: string } | null> => {
  const authResult = await resolveOverlayAuthFromRequest(request);

  if (authResult.kind !== 'authenticated') {
    return null;
  }

  return {
    client: authResult.client,
    token: authResult.token,
  };
};
