# Contabo Container Deploy

This site is containerized as a static React build served by Nginx.

## Files

- `Dockerfile`: multi-stage build for the Vite app
- `nginx.conf`: SPA routing and static asset caching
- `compose.yaml`: single-container runtime on port `8080`
- `deploy-contabo.sh`: sync and deploy helper over SSH

## Local Build

```bash
docker build -t lecrown-site .
docker run --rm -p 8080:8080 lecrown-site
```

Then open `http://localhost:8080`.

## Contabo Server Requirements

- Docker installed
- Docker Compose plugin installed
- SSH access to the server

## Manual Deploy

1. Copy the `site/` directory to the server.
2. If you want the chat to use the shared agent API, create a `.env` file beside `compose.yaml`:

```bash
VITE_AGENT_API_BASE_URL=https://chat.askmortgageauthority.com
VITE_AGENT_SITE_ID=lecrowndevelopment.com
VITE_AGENT_BOT_ID=benjamin-lagrone
```

3. On the server, run:

```bash
cd /opt/lecrown-site
docker compose up -d --build
```

The container serves the site on port `8080`.

## Scripted Deploy

From the local machine:

```bash
chmod +x deploy-contabo.sh
./deploy-contabo.sh user@your-contabo-host
```

Optional environment override:

```bash
REMOTE_DIR=/opt/lecrown-site ./deploy-contabo.sh user@your-contabo-host
```

## Reverse Proxy

If Nginx on the host terminates TLS for `lecrowndevelopment.com`, proxy it to `127.0.0.1:8080`.

Example host Nginx upstream target:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Shared Agent API

This site now supports an external browser-facing intake API. The contract is documented in `SHARED-AGENT-API.md`.

If that shared backend also exposes the LinkedIn auth broker endpoints described there, the contact chat can use LinkedIn sign-in for name/email prefill without adding any extra `VITE_*` variables to the static site.

Because Vite injects `VITE_*` variables at build time, changing the shared agent endpoint requires a rebuild.
