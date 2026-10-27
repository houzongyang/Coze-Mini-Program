# Production Deployment

This deployment package runs the Nest API, SQLite storage, document uploads,
LibreOffice conversion, and Python `pypdf` in one production container.

## Start

From the repository root on the server:

```sh
docker compose -f docker-compose.server.yml up -d --build
```

The API listens on port `3000` by default. Set `API_PORT` before starting when
the host port must differ:

```sh
API_PORT=8080 docker compose -f docker-compose.server.yml up -d --build
```

Check the service after it starts:

```sh
curl http://127.0.0.1:3000/api/health
docker compose -f docker-compose.server.yml logs -f api
```

## Persistent Data

The named `server-data` volume maps to `/app/data`. It contains:

- `example_db.sqlite`, the SQLite database
- `uploads`, original user files
- `uploads/_derived`, cached PDF previews created from Office files

Do not remove this volume during upgrades. Rebuilding or recreating the
container preserves it.

## Reverse Proxy

If an HTTP reverse proxy sits in front of the API, proxy `/api/` to the exposed
container port and allow request bodies of at least `50m`; the API accepts
uploads up to that size.

## Upgrade

Pull the new source and run the same `up -d --build` command. The image is
rebuilt while the named data volume remains attached.

## Backup

Back up the Docker volume before upgrades that change storage code. A backup
must include the complete `/app/data` tree so database rows, uploaded originals,
and generated PDF previews stay consistent.
