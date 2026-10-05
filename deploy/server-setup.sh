#!/usr/bin/env bash
# One-time production server bootstrap for restaurant-voice-os.
# Run this AS ROOT, once, on a fresh Ubuntu server:
#   ssh root@173.212.243.194
#   nano server-setup.sh   (paste this file's contents)
#   bash server-setup.sh
#
# What it does:
#   1. Installs Docker Engine + Compose plugin
#   2. Creates an unprivileged "deploy" user (member of the docker group)
#   3. Authorizes ONLY the GitHub Actions deploy key for that user
#   4. Creates /opt/restaurant-voice-os with a docker-compose.yml
#   5. Configures ufw firewall (SSH + app port only)
#   6. Installs fail2ban + unattended-upgrades
#   7. Disables SSH password auth and root SSH login (key-only from here on)
#
# After this script, GitHub Actions deploys as "deploy" via SSH key — never as root.

set -euo pipefail

DEPLOY_USER="deploy"
APP_DIR="/opt/restaurant-voice-os"
APP_PORT="3000"

# --- Paste the GitHub Actions deploy PUBLIC key below (never the private key) ---
DEPLOY_PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMZmPkve9QZGFchJV15tZLzSWeNwKYQGPGa+yAWYDFfF gha-deploy@restaurant-voice-os"

echo "==> Updating base packages"
apt-get update -y
apt-get upgrade -y

echo "==> Installing Docker Engine"
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
fi

echo "==> Creating ${DEPLOY_USER} user"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

echo "==> Authorizing deploy key for ${DEPLOY_USER}"
install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
echo "${DEPLOY_PUBLIC_KEY}" > "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"

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
touch "${APP_DIR}/.env"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
chmod 600 "${APP_DIR}/.env"

echo "==> Configuring firewall"
apt-get install -y ufw fail2ban unattended-upgrades
ufw allow OpenSSH
ufw allow "${APP_PORT}/tcp"
ufw --force enable

echo "==> Enabling automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now fail2ban

echo "==> Hardening SSH (key-only, no root login)"
SSHD_CONFIG="/etc/ssh/sshd_config"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "${SSHD_CONFIG}"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "${SSHD_CONFIG}"
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' "${SSHD_CONFIG}"
systemctl restart ssh

echo ""
echo "============================================================"
echo "Done. Verify from your OWN machine in a NEW terminal (keep"
echo "this session open until this succeeds):"
echo ""
echo "  ssh -i /path/to/gha_deploy_key ${DEPLOY_USER}@$(curl -s ifconfig.me)"
echo ""
echo "Root password login and root SSH are now disabled."
echo "If you get locked out, use your hosting provider's web console."
echo "============================================================"
