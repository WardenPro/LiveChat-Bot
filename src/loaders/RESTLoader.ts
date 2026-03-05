import { registerAdminDomainRoutes } from './rest/adminDomainRegistrar';
import { registerIngestDomainRoutes } from './rest/ingestDomainRegistrar';
import { registerOverlayDomainRoutes } from './rest/overlayDomainRegistrar';

export const loadRestRoutes = (fastify: FastifyCustomInstance) => {
  registerAdminDomainRoutes(fastify);
  registerOverlayDomainRoutes(fastify);
  registerIngestDomainRoutes(fastify);
};

// Legacy alias kept for phased migration compatibility.
export const loadRoutes = loadRestRoutes;
