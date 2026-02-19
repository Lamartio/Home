#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build.sh — Build a self-contained VS Code Web static site.
#
# The output lands in ./dist/ and can be deployed to any static host
# (GitHub Pages, Netlify, Cloudflare Pages, etc.).
#
# Requirements:
#   Node.js 18+     (20+ recommended)
#   yarn  1.x       (classic — VS Code still uses it)
#   Python 3        (for node-gyp)
#   C/C++ toolchain (gcc / clang — for native modules used during the build)
#   ~8 GB free RAM during the build
#
# Usage:
#   bash build.sh              # full build
#   bash build.sh --skip-clone # re-build without re-downloading VS Code
# ---------------------------------------------------------------------------
set -euo pipefail

VSCODE_TAG="${VSCODE_TAG:-1.96.4}"       # pin a known-good release
VSCODE_DIR="./vscode-source"
DIST_DIR="./dist"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

SKIP_CLONE=false
if [[ "${1:-}" == "--skip-clone" ]]; then
  SKIP_CLONE=true
fi

# ── 0. Preflight checks ────────────────────────────────────────────────────
echo "▸ Checking prerequisites…"
for cmd in node yarn python3 git; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "✘ $cmd is required but not found."; exit 1; }
done
echo "  node  $(node -v)"
echo "  yarn  $(yarn -v)"

# ── 1. Clone / update VS Code source ───────────────────────────────────────
if [[ "$SKIP_CLONE" == false ]]; then
  echo "▸ Cloning microsoft/vscode @ $VSCODE_TAG …"
  rm -rf "$VSCODE_DIR"
  git clone --depth 1 --branch "$VSCODE_TAG" \
      https://github.com/microsoft/vscode.git "$VSCODE_DIR"
fi

if [[ ! -d "$VSCODE_DIR" ]]; then
  echo "✘ $VSCODE_DIR not found. Run without --skip-clone first."
  exit 1
fi

# ── 2. Apply product configuration overrides ───────────────────────────────
echo "▸ Patching product.json …"
cd "$VSCODE_DIR"
# Merge our overrides into the product.json shipped by VS Code.
node -e "
  const fs = require('fs');
  const product = JSON.parse(fs.readFileSync('product.json', 'utf8'));
  const overrides = JSON.parse(fs.readFileSync('$ROOT_DIR/config/product-overrides.json', 'utf8'));
  Object.assign(product, overrides);
  // Ensure the built-in markdown extension is kept
  if (!product.builtInExtensions) product.builtInExtensions = [];
  fs.writeFileSync('product.json', JSON.stringify(product, null, '\t') + '\n');
"
cd "$ROOT_DIR"

# ── 3. Install dependencies ────────────────────────────────────────────────
echo "▸ Installing VS Code dependencies (this will take a while) …"
cd "$VSCODE_DIR"
yarn --frozen-lockfile --network-timeout 120000 || yarn --network-timeout 120000
cd "$ROOT_DIR"

# ── 4. Build VS Code Web ───────────────────────────────────────────────────
echo "▸ Building VS Code Web (minified) …"
cd "$VSCODE_DIR"
yarn gulp vscode-web-min
cd "$ROOT_DIR"

# The web build lands one directory above the VS Code source.
WEB_BUILD="../vscode-web"
if [[ -d "$VSCODE_DIR/../vscode-web" ]]; then
  WEB_BUILD="$VSCODE_DIR/../vscode-web"
fi

if [[ ! -d "$WEB_BUILD" ]]; then
  echo "✘ Could not locate the vscode-web build output."
  echo "  Expected at $WEB_BUILD"
  exit 1
fi

# ── 5. Assemble dist/ ──────────────────────────────────────────────────────
echo "▸ Assembling dist/ …"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy the VS Code Web build output
cp -R "$WEB_BUILD"/* "$DIST_DIR/"

# Replace the default workbench HTML with our customised version
cp "$ROOT_DIR/config/workbench.html" "$DIST_DIR/index.html"

# ── 6. Build & bundle the portfolio-startup extension ──────────────────────
echo "▸ Building portfolio-startup extension …"
cd "$ROOT_DIR/extensions/portfolio-startup"
npm install --ignore-scripts
npm run build
cd "$ROOT_DIR"

mkdir -p "$DIST_DIR/extensions/portfolio-startup/dist/web"
cp "$ROOT_DIR/extensions/portfolio-startup/package.json" \
   "$DIST_DIR/extensions/portfolio-startup/"
cp "$ROOT_DIR/extensions/portfolio-startup/dist/web/extension.js" \
   "$DIST_DIR/extensions/portfolio-startup/dist/web/"

# ── 7. Copy workspace files ────────────────────────────────────────────────
echo "▸ Copying workspace files …"
mkdir -p "$DIST_DIR/workspace"
cp -R "$ROOT_DIR/workspace/"* "$DIST_DIR/workspace/"

# ── 8. GitHub Pages / static-hosting niceties ──────────────────────────────
# .nojekyll tells GitHub Pages to serve files as-is (important for _-prefixed
# paths that the VS Code build sometimes emits).
touch "$DIST_DIR/.nojekyll"

echo ""
echo "✔ Build complete!  Output is in $DIST_DIR/"
echo "  Test locally:  npx serve dist --cors -l 8080"
echo "  Then open:     http://localhost:8080"
