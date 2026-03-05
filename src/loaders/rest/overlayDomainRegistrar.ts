import { OverlayRoutes } from '../../components/overlay/overlayRoutes';
import { registerDomainRoutes } from './registerDomainRoutes';

const OVERLAY_PREFIX = '/overlay';

export const registerOverlayDomainRoutes = (fastify: FastifyCustomInstance) => {
  registerDomainRoutes({
    fastify,
    prefix: OVERLAY_PREFIX,
    routes: OverlayRoutes,
  });
};
