#!/usr/bin/env bash
# Easix — dependency checker & installer

MISSING_TOOLS=()
MISSING_PKGS=()
NEED_NPM_INSTALL=false
IS_DEBIAN=false
IS_ALPINE=false

# --- Detect distro ---
if [ -f /etc/debian_version ]; then
    IS_DEBIAN=true
elif [ -f /etc/alpine-release ]; then
    IS_ALPINE=true
fi

# Ubuntu version for webkit selection
UBUNTU_VER="0"
if $IS_DEBIAN && [ -f /etc/os-release ]; then
    UBUNTU_VER=$(. /etc/os-release && echo "${VERSION_ID:-0}")
fi

# --- Tool checks ---
check_tool() {
    local label="$1" cmd="$2"
    if command -v "$cmd" &>/dev/null; then
        echo "  [OK]      $label"
    else
        echo "  [MISSING] $label"
        MISSING_TOOLS+=("$label")
    fi
}

echo ""
echo "=== Easix — requirements check ==="
echo ""
echo "Tools:"
check_tool "Node.js (node)"       "node"
check_tool "npm"                  "npm"
check_tool "Rust (cargo)"         "cargo"
check_tool "shellcheck (dry run)" "shellcheck"

# --- System packages ---
if $IS_DEBIAN; then
    if dpkg --compare-versions "$UBUNTU_VER" ge "24.04" 2>/dev/null; then
        WEBKIT_PKG="libwebkit2gtk-4.1-dev"
    else
        WEBKIT_PKG="libwebkit2gtk-4.0-dev"
    fi

    REQUIRED_PKGS=(
        "build-essential"
        "curl"
        "wget"
        "file"
        "libssl-dev"
        "libxdo-dev"
        "librsvg2-dev"
        "libayatana-appindicator3-dev"
        "$WEBKIT_PKG"
    )

    echo ""
    echo "System packages:"
    for pkg in "${REQUIRED_PKGS[@]}"; do
        if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
            echo "  [OK]      $pkg"
        else
            echo "  [MISSING] $pkg"
            MISSING_PKGS+=("$pkg")
        fi
    done
fi

if $IS_ALPINE; then
    REQUIRED_PKGS=(
        "build-base"
        "curl"
        "wget"
        "file"
        "openssl-dev"
        "webkit2gtk"
        "librsvg"
        "libayatana-appindicator"
    )

    echo ""
    echo "System packages:"
    for pkg in "${REQUIRED_PKGS[@]}"; do
        if apk info -e "$pkg" &>/dev/null; then
            echo "  [OK]      $pkg"
        else
            echo "  [MISSING] $pkg"
            MISSING_PKGS+=("$pkg")
        fi
    done
fi

# --- npm dependencies ---
echo ""
echo "Project:"
if [ ! -d "node_modules" ]; then
    echo "  [MISSING] node_modules (npm install needed)"
    NEED_NPM_INSTALL=true
else
    echo "  [OK]      node_modules"
fi

# --- Count missing ---
TOTAL_MISSING=$(( ${#MISSING_TOOLS[@]} + ${#MISSING_PKGS[@]} ))
if $NEED_NPM_INSTALL; then
    TOTAL_MISSING=$((TOTAL_MISSING + 1))
fi

echo ""
if [ "$TOTAL_MISSING" -eq 0 ]; then
    echo "=== All requirements satisfied. Starting Easix... ==="
    echo ""
    exit 0
fi

echo "=== Missing: $TOTAL_MISSING item(s) ==="
echo ""
read -rp "Install missing requirements now? (y/n): " ANSWER
echo ""

if [[ ! "$ANSWER" =~ ^[Yy]$ ]]; then
    echo "Skipping installation. The app may not start correctly."
    echo ""
    exit 0
fi

# --- Install Rust ---
if printf '%s\0' "${MISSING_TOOLS[@]}" | grep -qz "Rust"; then
    echo "[INSTALL] Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    source "$HOME/.cargo/env"
    echo "[OK]      Rust installed"
fi

# --- Install shellcheck ---
if printf '%s\0' "${MISSING_TOOLS[@]}" | grep -qz "shellcheck"; then
    if $IS_DEBIAN; then
        echo "[INSTALL] shellcheck..."
        sudo apt-get install -y shellcheck
    elif $IS_ALPINE; then
        echo "[INSTALL] shellcheck..."
        sudo apk add --quiet shellcheck
    fi
    echo "[OK]      shellcheck installed"
fi

# --- Install Node.js ---
if printf '%s\0' "${MISSING_TOOLS[@]}" | grep -qz "Node.js"; then
    if $IS_DEBIAN; then
        echo "[INSTALL] Node.js 20 via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif $IS_ALPINE; then
        echo "[INSTALL] Node.js (Alpine)..."
        sudo apk add --quiet nodejs npm
    fi
    echo "[OK]      Node.js installed"
fi

# --- Install system packages ---
if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    if $IS_DEBIAN; then
        echo "[INSTALL] System packages: ${MISSING_PKGS[*]}"
        sudo apt-get update -qq
        sudo apt-get install -y "${MISSING_PKGS[@]}"
    elif $IS_ALPINE; then
        echo "[INSTALL] System packages: ${MISSING_PKGS[*]}"
        sudo apk add --quiet "${MISSING_PKGS[@]}"
    fi
    echo "[OK]      System packages installed"
fi

# --- npm install ---
if $NEED_NPM_INSTALL; then
    echo "[INSTALL] npm dependencies..."
    npm install
    echo "[OK]      npm dependencies installed"
fi

echo ""
echo "=== Setup complete! Starting Easix... ==="
echo ""
