import { startCase } from 'lodash';

type DomainRoutesFactory = () => unknown;

interface RegisterDomainRoutesParams {
  fastify: FastifyCustomInstance;
  prefix: string;
  routes: DomainRoutesFactory;
}

export const registerDomainRoutes = ({ fastify, prefix, routes }: RegisterDomainRoutesParams) => {
  fastify.register(routes() as any, { prefix });

  const routeName = startCase(prefix.substring(1).replaceAll('/', ' '));
  logger.info(`[REST] ${routeName} Routes loaded (${prefix})`);
};
