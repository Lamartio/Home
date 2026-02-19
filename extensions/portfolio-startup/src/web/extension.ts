import * as vscode from 'vscode';
import { MemFS } from './memfs';

const SCHEME = 'memfs';

export function activate(context: vscode.ExtensionContext): void {
  const memFs = new MemFS();

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(SCHEME, memFs, { isReadonly: true })
  );

  // Seed workspace files by fetching them from the static /workspace/ directory.
  // If the fetch fails (e.g. local dev without the file), fall back to a
  // small built-in placeholder so the extension still works.
  seedWorkspace(memFs).then(() => {
    showReadmePreview();
  });
}

async function seedWorkspace(memFs: MemFS): Promise<void> {
  const files = ['README.md'];

  for (const file of files) {
    try {
      // Workspace assets are served at /workspace/ relative to the site root.
      const response = await fetch(`./workspace/${file}`);
      if (response.ok) {
        const text = await response.text();
        memFs.seedFile(`/${file}`, new TextEncoder().encode(text));
        continue;
      }
    } catch {
      // fetch failed — use fallback below
    }

    // Fallback content when the static file is not available
    memFs.seedFile(
      `/${file}`,
      new TextEncoder().encode(
        '# Welcome\n\nReplace `workspace/README.md` with your own content.\n'
      )
    );
  }
}

async function showReadmePreview(): Promise<void> {
  const uri = vscode.Uri.parse(`${SCHEME}:/README.md`);

  try {
    // Small delay to let the workbench finish initialising and for the
    // built-in Markdown extension to be ready.
    await sleep(600);

    // 1. Open the raw Markdown file so the Markdown extension has a context
    //    document to preview.
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });

    // 2. Ask the built-in Markdown extension to open its preview.
    await vscode.commands.executeCommand('markdown.showPreview');

    // 3. Brief pause then close the underlying raw editor tab so only the
    //    rendered preview remains.
    await sleep(400);

    // Move focus back to the first editor group and close the raw tab.
    await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    // The raw tab is the text editor; find it and close it.
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (
          tab.input instanceof vscode.TabInputText &&
          tab.input.uri.toString() === uri.toString()
        ) {
          await vscode.window.tabGroups.close(tab);
        }
      }
    }
  } catch (err) {
    // Non-fatal — the workspace is still usable even if the auto-preview fails.
    console.warn('[portfolio-startup] Could not auto-open README preview:', err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function deactivate(): void {
  // nothing to clean up
}
