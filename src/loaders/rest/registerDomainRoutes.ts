import { startCase } from 'lodash';

type DomainRoutesPlugin = (fastify: FastifyCustomInstance) => Promise<void>;
type DomainRoutesFactory = () => DomainRoutesPlugin;

interface RegisterDomainRoutesParams {
  fastify: FastifyCustomInstance;
  prefix: string;
  routes: DomainRoutesFactory;
}

export const registerDomainRoutes = ({ fastify, prefix, routes }: RegisterDomainRoutesParams) => {
  const registerPlugin = routes();

  fastify.register(
    async (instance) => {
      await registerPlugin(instance as FastifyCustomInstance);
    },
    { prefix },
  );

  const routeName = startCase(prefix.substring(1).replaceAll('/', ' '));
  logger.info(`[REST] ${routeName} Routes loaded (${prefix})`);
};
