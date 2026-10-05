# Deployment

Push to `resturant_light_os` → GitHub Actions builds a Docker image, pushes
it to GHCR (`ghcr.io/<owner>/resturant-voice-os-eng`), syncs `docker-compose.yml`
to the server, then SSHes in as the unprivileged `deploy` user and recreates
the containers with the new image. No long-lived secret ever touches the
container image itself; runtime secrets (`GEMINI_API_KEY`, etc.) are written
to `/opt/restaurant-voice-os/.env` on the server at deploy time, straight
from GitHub Secrets.

## TLS

`docker-compose.yml` also runs `nginx-proxy` + `acme-companion` in front of
the app. They auto-detect the `app` container via its `VIRTUAL_HOST` /
`LETSENCRYPT_HOST` env vars (currently `servio.servicesground.com`, which
must already have a DNS A record pointing at the server) and automatically
obtain and renew a Let's Encrypt certificate — no manual certbot steps, no
sudo needed on the server (it's all plain `docker`, which `deploy` already
has access to). The app is reachable on 80/443 through the proxy and
still directly on `:3000`. To change the domain, update `VIRTUAL_HOST` /
`LETSENCRYPT_HOST` in `docker-compose.yml` and push.

This is a **shared server**, so the setup script deliberately does not touch
the firewall or SSH config (root/password SSH login stays exactly as it is
today). It only installs Docker, creates the `deploy` user, and authorizes
the CI deploy key for that user. Revisit firewall lockdown and root-password
rotation separately once other things on this box are accounted for.

## One-time server setup

1. SSH to the server as root (as you do today):
   ```
   ssh root@173.212.243.194
   ```
2. Copy `deploy/server-setup.sh` onto the server and run it:
   ```
   bash server-setup.sh
   ```
   It creates the `deploy` user, installs Docker (skipped if already
   present), and authorizes the CI deploy key for that user only.
3. Verify key-based access works:
   ```
   ssh -i gha_deploy_key deploy@173.212.243.194 docker ps
   ```
4. Make sure port `3000` is reachable through whatever firewall or
   security-group this server already uses — the script does not open it
   for you.

## Required GitHub Secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret            | Value                                                            |
|-------------------|-------------------------------------------------------------------|
| `SSH_HOST`        | `173.212.243.194`                                                 |
| `SSH_USER`        | `deploy`                                                          |
| `SSH_PORT`        | `22`                                                              |
| `SSH_PRIVATE_KEY` | contents of `gha_deploy_key` (the **private** half — never commit it) |
| `GEMINI_API_KEY`  | your Gemini API key                                               |
| `APP_URL`         | `https://servio.servicesground.com`                               |

Nothing else needs secrets — GHCR auth uses the automatic `GITHUB_TOKEN`.

These are currently set as **environment secrets** on the `staging`
GitHub Environment (the workflow's `deploy` job targets `environment: staging`
to match). Optional extra hardening: add required reviewers to that
environment so every deploy needs a manual approval click.

## Rollback

Every image is also tagged with its commit SHA. To roll back without a new
push:
```
ssh -i gha_deploy_key deploy@173.212.243.194
cd /opt/restaurant-voice-os
IMAGE=ghcr.io/<owner>/resturant-voice-os-eng:<previous-sha> docker compose up -d
```
