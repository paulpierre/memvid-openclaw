#!/bin/bash
#
# memvid-openclaw installer for Clawdbot
# Usage: curl -fsSL https://raw.githubusercontent.com/paulpierre/memvid-openclaw/main/install.sh | bash
#

set -e

REPO_URL="https://github.com/paulpierre/memvid-openclaw.git"
PLUGIN_NAME="memvid-openclaw"
NPM_PACKAGE="@paulpierre/memvid-openclaw"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if clawdbot is installed
check_clawdbot() {
    if ! command -v clawdbot &> /dev/null; then
        log_error "Clawdbot is not installed or not in PATH"
        log_info "Install Clawdbot first: npm install -g clawdbot"
        exit 1
    fi
    log_success "Clawdbot found: $(which clawdbot)"
}

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js 20+ required (found: $(node -v))"
        exit 1
    fi
    log_success "Node.js $(node -v) found"
}

# Install via npm (preferred)
install_npm() {
    log_info "Installing via npm..."
    
    if clawdbot plugins install "$NPM_PACKAGE" 2>/dev/null; then
        log_success "Installed $NPM_PACKAGE via npm"
        return 0
    fi
    
    return 1
}

# Install via git clone (fallback)
install_git() {
    log_info "Installing via git clone..."
    
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR/$PLUGIN_NAME"
    cd "$TEMP_DIR/$PLUGIN_NAME"
    
    npm install
    npm run build
    
    clawdbot plugins install .
    
    log_success "Installed $PLUGIN_NAME via git"
}

# Download embedding models (optional)
download_models() {
    read -p "Download local embedding models (BGE-small, ~120MB)? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        MODEL_DIR="$HOME/.cache/memvid/text-models"
        mkdir -p "$MODEL_DIR"
        
        log_info "Downloading BGE-small model..."
        curl -L 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/onnx/model.onnx' \
            -o "$MODEL_DIR/bge-small-en-v1.5.onnx"
        curl -L 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer.json' \
            -o "$MODEL_DIR/bge-small-en-v1.5_tokenizer.json"
        
        log_success "Models downloaded to $MODEL_DIR"
    fi
}

# Enable the plugin
enable_plugin() {
    log_info "Enabling memvid plugin..."
    clawdbot plugins enable memvid 2>/dev/null || true
    log_success "Plugin enabled"
}

# Print post-install instructions
print_instructions() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  memvid-openclaw installed successfully! 🎉${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "  1. Restart the gateway:"
    echo "     clawdbot gateway restart"
    echo ""
    echo "  2. (Optional) Configure in clawdbot.json:"
    echo "     plugins.entries.memvid.config.storagePath"
    echo "     plugins.entries.memvid.config.defaultCollection"
    echo ""
    echo "  3. Test the tools:"
    echo "     memvid_store, memvid_search, memvid_list"
    echo ""
    echo "Documentation: https://github.com/paulpierre/memvid-openclaw"
    echo ""
}

# Main
main() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  memvid-openclaw installer for Clawdbot${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    check_node
    check_clawdbot
    
    # Try npm first, fallback to git
    if ! install_npm; then
        log_warn "npm install failed, trying git..."
        install_git
    fi
    
    enable_plugin
    download_models
    print_instructions
}

main "$@"
