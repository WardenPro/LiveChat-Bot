# LiveChatCaCaBox

Backend Discord/API pour l'architecture LiveChat **EXE-only**.

Documentation projet: `../README.md`
PRD: `../PRD.md`

## Projets liés (sources)

- Bot (ce dépôt): https://github.com/WardenPro/LiveChat-Bot
- Overlay desktop (Electron): https://github.com/SuperKn4cky/LiveChat-Overlay
- Extension navigateur (MV3): https://github.com/SuperKn4cky/LiveChat-Extension

## Rôle

- Reçoit les commandes Discord.
- Télécharge et normalise les médias (yt-dlp + ffmpeg).
- Met en cache les assets (TTL 12h).
- Expose les routes `/overlay/*`.
- Expose la route `/ingest` (API simple pour raccourcis iOS).
- Diffuse les événements socket vers les overlays appairés.

## Démarrage rapide

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Option TikTok restreint (login requis):
- `TIKTOK_COOKIE` peut contenir un header cookie TikTok (`name=value; name2=value2`) pour tenter l'extraction avec un compte autorisé.

## Quotas stockage média

- `MEDIA_CACHE_MAX_TOTAL_MB=5120` (5 Go): limite totale du cache **non persistant**.
- `MEDIA_BOARD_MAX_TOTAL_MB=15360` (15 Go): limite par serveur Discord pour la meme board persistante.

## API iOS (`/ingest`)

Créer d'abord un **ingest client token** dans `/admin` (section `Create Ingest Client`), puis appeler:

```bash
curl -X POST "$API_URL/ingest" \
  -H "Authorization: Bearer $INGEST_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://vm.tiktok.com/ZNRfPWMaF/",
    "text": "hello depuis iOS",
    "forceRefresh": true
  }'
```

Payload minimal:
- au moins un de `url`, `media`, `text`
- `forceRefresh` optionnel (`true` pour ignorer le cache média et forcer re-download/re-transcode)
- `guildId`, `authorName`, `authorImage` sont liés au token ingest client et ne doivent pas être envoyés.

## Normalisation du volume

La normalisation loudness est activée par défaut pendant la transcode:
- `MEDIA_AUDIO_NORMALIZE_ENABLED=true`
- `MEDIA_AUDIO_LOUDNORM_I=-18`
- `MEDIA_AUDIO_LOUDNORM_LRA=11`
- `MEDIA_AUDIO_LOUDNORM_TP=-1.5`

## Endpoints publics

- `GET /` -> statut service minimal
- `GET /health` -> healthcheck
- `GET /admin?token=<ADMIN_UI_TOKEN>` -> panel admin local (token requis)

## Admin panel local (`/admin`)

- Activer avec `ADMIN_UI_TOKEN` dans `.env`.
- `ADMIN_UI_LOCAL_ONLY=true` (défaut): accès limité loopback (`127.0.0.1` / `::1`).
- `ADMIN_UI_LOCAL_ONLY=false`: accès LAN autorisé (token toujours requis).
- Le panel expose:
  - guilds connues + nom Discord (si disponible)
  - overlays connectés/hors ligne
  - usage cache global et meme board par guild
  - actions admin: réglages guild, stop playback, création/révocation clients ingest, révocation clients overlay, gestion pairing codes

Les erreurs HTTP sont volontairement normalisées (`not_found`, `request_error`, `internal_error`) sans stack trace exposée.

## Tests

### Lancer les tests

```bash
# Suite de tests unitaires
pnpm test:unit

# Vérification que chaque module source a au moins un test
pnpm test:unit:matrix

# Tests de caractérisation (comportement observable en conditions réelles)
pnpm characterization
```

### Quality gates complets

```bash
pnpm lint
pnpm build
pnpm test:unit
pnpm test:unit:matrix
```

Ces quatre commandes sont aussi exécutées automatiquement par le workflow CI (`.github/workflows/ci.yml`) sur chaque push et pull request vers `main`, et par le hook `pre-push` local.

### Structure

```
tests/
└── unit/
    ├── matrix/          # Script de vérification couverture modules
    ├── components/      # Tests commandes Discord et messages
    ├── loaders/         # Tests loaders REST, socket, Discord
    ├── repositories/    # Tests repositories Prisma
    ├── services/        # Tests services (auth, media, i18n, social…)
    ├── index.test.ts
    └── server.test.ts
```

Chaque module runtime sous `src/` doit avoir un fichier de test correspondant — `pnpm test:unit:matrix` échoue si un module est ajouté sans test.

## Docker Hub (GitHub Actions)

Le workflow `/.github/workflows/docker.yml` build et pousse l'image sur Docker Hub:
- sur push vers `main`
- sur tag `v*`
- en exécution manuelle (`workflow_dispatch`)

Secrets GitHub requis:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN` (token d'accès Docker Hub)

Image publiée:
- `${DOCKERHUB_USERNAME}/livechat-bot:latest`
- `${DOCKERHUB_USERNAME}/livechat-bot:sha-<commit>`
