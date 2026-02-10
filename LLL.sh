#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Easix provisioning script
# Generated for: machine01 (debian11)
# =============================================================================

echo "=== Easix provisioning started ==="

# --- Hostname ---
echo "Setting hostname to machine01..."
hostnamectl set-hostname "machine01"

# --- System update ---
echo "Updating package lists..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq


# --- Packages ---
echo "Installing packages: python3, git, htop, xfce..."
apt-get install -y -qq \
  python3 \\
  git \\
  htop \\
  xfce


# --- User ---
echo "Configuring user 'admin'..."
if ! id "admin" &>/dev/null; then
    useradd -m -s /bin/bash "admin"
fi

usermod -aG sudo "admin"



# --- Network (static) ---
echo "Configuring static network..."
cat > /etc/netplan/01-easix.yaml << 'NETPLAN'
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.88.1


NETPLAN
netplan apply || true








echo "=== Easix provisioning completed ==="
