import { registerAdminDomainRoutes } from './rest/adminDomainRegistrar';
import { registerIngestDomainRoutes } from './rest/ingestDomainRegistrar';
import { registerOverlayDomainRoutes } from './rest/overlayDomainRegistrar';

export const loadRoutes = (fastify: FastifyCustomInstance) => {
  registerAdminDomainRoutes(fastify);
  registerOverlayDomainRoutes(fastify);
  registerIngestDomainRoutes(fastify);
};
