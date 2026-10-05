# Deployment

Push to `main` → GitHub Actions builds a Docker image, pushes it to GHCR
(`ghcr.io/<owner>/resturant-voice-os-eng`), then SSHes into the production
server as the unprivileged `deploy` user and recreates the container with
the new image. No long-lived secret ever touches the container image itself;
runtime secrets (`GEMINI_API_KEY`, etc.) are written to `/opt/restaurant-voice-os/.env`
on the server at deploy time, straight from GitHub Secrets.

## One-time server setup

1. SSH to the server as root (last time you'll need the root password):
   ```
   ssh root@173.212.243.194
   ```
2. Copy `deploy/server-setup.sh` onto the server and run it:
   ```
   bash server-setup.sh
   ```
   It creates the `deploy` user, installs Docker, authorizes the CI deploy
   key, sets up the firewall (ufw: SSH + port 3000 only), enables
   fail2ban + unattended security updates, and **disables SSH password
   auth and root login** — from then on, only key-based login as `deploy`
   works.
3. Verify key-based access works *before* closing the root session:
   ```
   ssh -i gha_deploy_key deploy@173.212.243.194
   ```
4. Rotate the original root password (it was shared in plaintext once —
   treat it as burned) via your hosting provider's control panel.

## Required GitHub Secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret            | Value                                                            |
|-------------------|-------------------------------------------------------------------|
| `SSH_HOST`        | `173.212.243.194`                                                 |
| `SSH_USER`        | `deploy`                                                          |
| `SSH_PORT`        | `22`                                                              |
| `SSH_PRIVATE_KEY` | contents of `gha_deploy_key` (the **private** half — never commit it) |
| `GEMINI_API_KEY`  | your Gemini API key                                               |
| `APP_URL`         | `http://173.212.243.194:3000` (or your future domain)             |

Nothing else needs secrets — GHCR auth uses the automatic `GITHUB_TOKEN`.

Optional extra hardening: in Settings → Environments, create a `production`
environment (already referenced by the workflow) and add required reviewers,
so every deploy needs a manual approval click.

## Rollback

Every image is also tagged with its commit SHA. To roll back without a new
push:
```
ssh deploy@173.212.243.194
cd /opt/restaurant-voice-os
IMAGE=ghcr.io/<owner>/resturant-voice-os-eng:<previous-sha> docker compose up -d
```
