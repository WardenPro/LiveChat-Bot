import type { FastifyRequest } from 'fastify';
import { generateOverlayToken, getBearerTokenFromRequest, hashOverlayToken } from './overlayAuth';

export interface CreateIngestClientTokenParams {
  guildId: string;
  label: string;
  defaultAuthorName: string;
  defaultAuthorImage: string | null;
  createdByDiscordUserId: string;
}

export interface IngestClientRecord {
  id: string;
  guildId: string;
  label: string;
  tokenHash: string;
  defaultAuthorName: string;
  defaultAuthorImage: string | null;
  createdByDiscordUserId: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

interface IngestClientCreateArgs {
  data: {
    guildId: string;
    label: string;
    tokenHash: string;
    defaultAuthorName: string;
    defaultAuthorImage: string | null;
    createdByDiscordUserId: string;
  };
}

interface IngestClientFindByTokenArgs {
  where: {
    tokenHash: string;
    revokedAt: null;
  };
}

interface IngestClientFindAnyActiveArgs {
  where: {
    revokedAt: null;
  };
  select: {
    id: true;
  };
}

interface IngestClientUpdateManyArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

interface IngestClientDelegate {
  create(args: IngestClientCreateArgs): Promise<IngestClientRecord>;
  findFirst(args: IngestClientFindByTokenArgs): Promise<IngestClientRecord | null>;
  findFirst(args: IngestClientFindAnyActiveArgs): Promise<{ id: string } | null>;
  updateMany(args: IngestClientUpdateManyArgs): Promise<{ count: number }>;
}

const isIngestClientDelegate = (value: unknown): value is IngestClientDelegate => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    typeof Reflect.get(value, 'create') === 'function' &&
    typeof Reflect.get(value, 'findFirst') === 'function' &&
    typeof Reflect.get(value, 'updateMany') === 'function'
  );
};

const getIngestClientDelegate = (): IngestClientDelegate | null => {
  const delegate = Reflect.get(prisma, 'ingestClient');
  return isIngestClientDelegate(delegate) ? delegate : null;
};

export const createIngestClientToken = async (params: CreateIngestClientTokenParams) => {
  const delegate = getIngestClientDelegate();

  if (!delegate) {
    throw new Error('ingest_client_model_unavailable');
  }

  const rawToken = generateOverlayToken();
  const tokenHash = hashOverlayToken(rawToken);

  const client = await delegate.create({
    data: {
      guildId: params.guildId,
      label: params.label,
      tokenHash,
      defaultAuthorName: params.defaultAuthorName,
      defaultAuthorImage: params.defaultAuthorImage,
      createdByDiscordUserId: params.createdByDiscordUserId,
    },
  });

  return {
    client,
    rawToken,
  };
};

export const revokeIngestClientsForGuildLabel = async (guildId: string, label: string): Promise<void> => {
  const delegate = getIngestClientDelegate();

  if (!delegate) {
    return;
  }

  await delegate.updateMany({
    where: {
      guildId,
      label,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const resolveIngestClientFromRequest = async (
  request: FastifyRequest,
): Promise<{ client: IngestClientRecord } | null> => {
  const token = getBearerTokenFromRequest(request);
  const delegate = getIngestClientDelegate();

  if (!token || !delegate) {
    return null;
  }

  const tokenHash = hashOverlayToken(token);

  const client = await delegate.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
  });

  if (!client) {
    return null;
  }

  await delegate.updateMany({
    where: {
      id: client.id,
      revokedAt: null,
    },
    data: {
      lastSeenAt: new Date(),
    },
  });

  return {
    client,
  };
};

export type IngestAuthResult = {
  kind: 'client';
  client: IngestClientRecord;
};

export const resolveIngestAuthFromRequest = async (request: FastifyRequest): Promise<IngestAuthResult | null> => {
  const clientResult = await resolveIngestClientFromRequest(request);

  if (!clientResult) {
    return null;
  }

  return {
    kind: 'client',
    client: clientResult.client,
  };
};

export const isIngestApiEnabled = async (): Promise<boolean> => {
  const delegate = getIngestClientDelegate();

  if (!delegate) {
    return false;
  }

  const activeClient = await delegate.findFirst({
    where: {
      revokedAt: null,
    },
    select: {
      id: true,
    },
  });

  return !!activeClient;
};
