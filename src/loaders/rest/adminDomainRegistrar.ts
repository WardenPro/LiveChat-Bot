import { AdminRoutes } from '../../components/admin/adminRoutes';
import { registerDomainRoutes } from './registerDomainRoutes';

const ADMIN_PREFIX = '/admin';

export const registerAdminDomainRoutes = (fastify: FastifyCustomInstance) => {
  registerDomainRoutes({
    fastify,
    prefix: ADMIN_PREFIX,
    routes: AdminRoutes,
  });
};
