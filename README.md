# VS Code Web — Read-Only Portfolio

A self-hosted **VS Code for the Web** instance that opens your `README.md` as
a rendered Markdown preview on load. Runs entirely in the browser — no backend
server required — and deploys as a static site to **GitHub Pages**.

## How it works

| Layer                    | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| VS Code Web build        | Full VS Code running client-side (built from source)     |
| `portfolio-startup` ext  | Registers an in-memory file system, seeds `README.md`, auto-opens the Markdown preview on startup |
| `config/workbench.html`  | Custom entry point that configures read-only mode, dark theme, and loads the extension |
| `workspace/README.md`    | Your portfolio content (replace with your own)           |

## Prerequisites

- **Node.js 18+** (20 recommended)
- **Yarn 1.x** (classic) — `npm install -g yarn@1`
- **Python 3** (for `node-gyp`)
- **C/C++ toolchain** (`build-essential` on Ubuntu, Xcode CLI tools on macOS)
- ~8 GB free RAM during the build

On Ubuntu / Debian:

```bash
sudo apt-get install -y build-essential pkg-config \
  libx11-dev libxkbfile-dev libsecret-1-dev
```

On macOS:

```bash
xcode-select --install
```

## Build

```bash
# Full build (clones VS Code, builds it, bundles the extension, assembles dist/)
bash build.sh

# Rebuild without re-cloning VS Code source
bash build.sh --skip-clone
```

You can pin a specific VS Code release tag:

```bash
VSCODE_TAG=1.96.4 bash build.sh
```

## Test locally

After building, serve the `dist/` folder with any static server:

```bash
npx serve dist --cors -l 8080
```

Then open **http://localhost:8080** in a Chromium-based browser (Chrome, Edge,
Brave). Firefox works too but some VS Code Web features have limited support.

You should see:

1. VS Code loads in a dark theme.
2. The Markdown preview of `README.md` opens automatically.
3. All files are read-only.

## Deploy to GitHub Pages

### Option A — GitHub Actions (recommended)

1. Push this repo to GitHub.
2. Go to **Settings → Pages → Source** and select **GitHub Actions**.
3. Push to `main`. The `.github/workflows/deploy.yml` workflow will build and
   deploy automatically.

### Option B — Manual deploy

1. Run `bash build.sh` locally.
2. Push the contents of `dist/` to a `gh-pages` branch:

   ```bash
   npx gh-pages -d dist
   ```

## Customisation

### Replace the portfolio content

Edit **`workspace/README.md`** with your own content. If you need additional
files in the workspace, add them to `workspace/` and list them in the `files`
array inside `extensions/portfolio-startup/src/web/extension.ts` →
`seedWorkspace()`.

### Change default settings

Default editor/theme settings are configured in two places:

- `extensions/portfolio-startup/package.json` → `contributes.configurationDefaults`
- `config/workbench.html` → the `configurationDefaults` object

### Branding / product name

Edit `config/product-overrides.json` to change the window title and
application name.

## Project structure

```
.
├── build.sh                              # Build automation
├── config/
│   ├── product-overrides.json            # Product branding overrides
│   └── workbench.html                    # Custom workbench entry point
├── extensions/
│   └── portfolio-startup/
│       ├── package.json                  # Extension manifest
│       ├── tsconfig.json
│       ├── webpack.config.js
│       └── src/web/
│           ├── extension.ts              # Activation: seed FS, open preview
│           └── memfs.ts                  # In-memory FileSystemProvider
├── workspace/
│   └── README.md                         # ← your portfolio content
├── .github/workflows/
│   └── deploy.yml                        # GitHub Actions → Pages
└── package.json
```

## Fallback / lighter alternatives

The full VS Code build is large and can be finicky. If it gives you trouble,
consider these lighter paths:

1. **`@vscode/test-web`** — Designed for extension testing but can serve a
   VS Code Web instance with your extension loaded. Quick way to iterate:

   ```bash
   npx @vscode/test-web --extensionDevelopmentPath=./extensions/portfolio-startup
   ```

2. **vscode.dev redirect** — If you just need a link that opens your repo in
   VS Code Web: `https://vscode.dev/github/<user>/<repo>`.

3. **code-server** — If you can run a small server (e.g. on a VPS), code-server
   gives you VS Code in the browser with minimal build effort.

## License

MIT
