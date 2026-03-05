import { IngestRoutes } from '../../components/ingest/ingestRoutes';
import { registerDomainRoutes } from './registerDomainRoutes';

const INGEST_PREFIX = '/ingest';

export const registerIngestDomainRoutes = (fastify: FastifyCustomInstance) => {
  registerDomainRoutes({
    fastify,
    prefix: INGEST_PREFIX,
    routes: IngestRoutes,
  });
};
