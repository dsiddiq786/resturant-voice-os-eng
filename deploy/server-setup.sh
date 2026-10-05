#!/usr/bin/env bash
# One-time production server bootstrap for restaurant-voice-os.
# Run this AS ROOT, once, on the server:
#   ssh root@173.212.243.194
#   nano server-setup.sh   (paste this file's contents)
#   bash server-setup.sh
#
# This is a SHARED server — the script intentionally does NOT touch
# the firewall, SSH config, or run a blanket package upgrade. It only:
#   1. Installs Docker Engine + Compose plugin (skipped if already present)
#   2. Creates an unprivileged "deploy" user (member of the docker group)
#   3. Authorizes the GitHub Actions deploy key for that user ONLY
#   4. Creates /opt/restaurant-voice-os with a docker-compose.yml
#
# Root SSH / password login is left exactly as it is today. GitHub Actions
# will deploy as "deploy" via SSH key, never as root.

set -euo pipefail

DEPLOY_USER="deploy"
APP_DIR="/opt/restaurant-voice-os"

# --- GitHub Actions deploy PUBLIC key (never the private key) ---
DEPLOY_PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMZmPkve9QZGFchJV15tZLzSWeNwKYQGPGa+yAWYDFfF gha-deploy@restaurant-voice-os"

echo "==> Refreshing package index (no upgrade of existing packages)"
apt-get update -y

echo "==> Installing Docker Engine (skipped if already installed)"
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "    docker already present, skipping install"
fi

echo "==> Creating ${DEPLOY_USER} user (skipped if already exists)"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

echo "==> Authorizing deploy key for ${DEPLOY_USER}"
install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
if ! grep -qF "${DEPLOY_PUBLIC_KEY}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"; then
  echo "${DEPLOY_PUBLIC_KEY}" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"

echo "==> Setting up ${APP_DIR}"
mkdir -p "${APP_DIR}"
cat > "${APP_DIR}/docker-compose.yml" <<'EOF'
services:
  app:
    image: ${IMAGE}
    container_name: restaurant-voice-os
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
EOF
[ -f "${APP_DIR}/.env" ] || touch "${APP_DIR}/.env"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
chmod 600 "${APP_DIR}/.env"

echo ""
echo "============================================================"
echo "Done. Root SSH / password login is UNCHANGED."
echo "Firewall is UNCHANGED -- make sure port 3000 is reachable"
echo "through whatever firewall/security-group this server already uses."
echo ""
echo "Verify key-based access works:"
echo "  ssh -i gha_deploy_key ${DEPLOY_USER}@173.212.243.194 docker ps"
echo "============================================================"
