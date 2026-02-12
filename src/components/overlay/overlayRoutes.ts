import fs, { createReadStream, promises as fsPromises } from 'fs';
import { addMinutes } from 'date-fns';
import { OVERLAY_PROTOCOL_VERSION } from '@livechat/overlay-protocol';
import { createOverlayClientToken, resolveOverlayClientFromRequest } from '../../services/overlayAuth';
import { touchMediaAsset } from '../../services/media/mediaCache';

interface ConsumePairingBody {
  code: string;
  deviceName: string;
}

const parseRangeHeader = (rawRangeHeader: string, fileSize: number) => {
  const normalizedRange = rawRangeHeader.split(',')[0]?.trim() || '';
  const match = /^bytes=(\d*)-(\d*)$/i.exec(normalizedRange);

  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) {
    return null;
  }

  if (!rawStart) {
    const suffixLength = Number.parseInt(rawEnd, 10);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(fileSize - suffixLength, 0);
    const end = fileSize - 1;

    return { start, end };
  }

  const start = Number.parseInt(rawStart, 10);

  if (!Number.isFinite(start) || start < 0 || start >= fileSize) {
    return null;
  }

  let end = fileSize - 1;

  if (rawEnd) {
    const parsedEnd = Number.parseInt(rawEnd, 10);

    if (!Number.isFinite(parsedEnd) || parsedEnd < start) {
      return null;
    }

    end = Math.min(parsedEnd, fileSize - 1);
  }

  return { start, end };
};

export const OverlayRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.post<{ Body: ConsumePairingBody }>('/pair/consume', async (request, reply) => {
      const rawCode = request.body?.code?.toUpperCase()?.trim();
      const deviceName = request.body?.deviceName?.trim();

      if (!rawCode || !deviceName) {
        return reply.code(400).send({
          error: 'invalid_payload',
        });
      }

      await prisma.pairingCode.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      const pairingCode = await prisma.pairingCode.findFirst({
        where: {
          code: rawCode,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!pairingCode) {
        return reply.code(404).send({
          error: 'pairing_code_invalid_or_expired',
        });
      }

      await prisma.pairingCode.update({
        where: {
          code: pairingCode.code,
        },
        data: {
          usedAt: new Date(),
          expiresAt: addMinutes(new Date(), -1),
        },
      });

      const { client, rawToken } = await createOverlayClientToken({
        guildId: pairingCode.guildId,
        label: deviceName,
      });

      return reply.send({
        clientToken: rawToken,
        clientId: client.id,
        guildId: pairingCode.guildId,
        apiBaseUrl: env.API_URL,
      });
    });

    fastify.get('/config', async (request, reply) => {
      const authResult = await resolveOverlayClientFromRequest(request);

      if (!authResult) {
        return reply.code(401).send({
          error: 'unauthorized',
        });
      }

      const guild = await prisma.guild.findFirst({
        where: {
          id: authResult.client.guildId,
        },
      });

      return reply.send({
        guildId: authResult.client.guildId,
        protocolVersion: OVERLAY_PROTOCOL_VERSION,
        showTextDefault: true,
        defaultMediaTime: guild?.defaultMediaTime ?? env.DEFAULT_DURATION,
        maxMediaTime: guild?.maxMediaTime ?? null,
      });
    });

    fastify.get<{ Params: { assetId: string } }>('/media/:assetId', async (request, reply) => {
      const authResult = await resolveOverlayClientFromRequest(request);

      if (!authResult) {
        return reply.code(401).send({
          error: 'unauthorized',
        });
      }

      const asset = await prisma.mediaAsset.findFirst({
        where: {
          id: request.params.assetId,
        },
      });

      if (!asset || asset.status !== 'READY' || asset.expiresAt <= new Date()) {
        return reply.code(404).send({
          error: 'media_not_found',
        });
      }

      if (!fs.existsSync(asset.storagePath)) {
        return reply.code(404).send({
          error: 'media_not_found_on_disk',
        });
      }

      const access = await prisma.playbackJob.findFirst({
        where: {
          mediaAssetId: asset.id,
          guildId: authResult.client.guildId,
        },
      });

      if (!access) {
        return reply.code(403).send({
          error: 'forbidden',
        });
      }

      await touchMediaAsset(asset.id);

      const fileStat = await fsPromises.stat(asset.storagePath).catch(() => null);

      if (!fileStat || fileStat.size <= 0) {
        return reply.code(404).send({
          error: 'media_not_found_on_disk',
        });
      }

      reply.header('Cache-Control', 'no-store');
      reply.header('Accept-Ranges', 'bytes');
      reply.type(asset.mime);

      const rangeHeader = request.headers.range;

      if (typeof rangeHeader === 'string' && rangeHeader.trim() !== '') {
        const parsedRange = parseRangeHeader(rangeHeader, fileStat.size);

        if (!parsedRange) {
          reply.header('Content-Range', `bytes */${fileStat.size}`);
          reply.type('application/json');
          return reply.code(416).send({
            error: 'invalid_range',
          });
        }

        const chunkLength = parsedRange.end - parsedRange.start + 1;

        reply.code(206);
        reply.header('Content-Range', `bytes ${parsedRange.start}-${parsedRange.end}/${fileStat.size}`);
        reply.header('Content-Length', `${chunkLength}`);

        return createReadStream(asset.storagePath, {
          start: parsedRange.start,
          end: parsedRange.end,
        });
      }

      reply.header('Content-Length', `${fileStat.size}`);

      return createReadStream(asset.storagePath);
    });
  };
