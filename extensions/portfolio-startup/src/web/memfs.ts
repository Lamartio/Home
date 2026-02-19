import * as vscode from 'vscode';

export class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  data: Uint8Array;

  constructor(public name: string, data?: Uint8Array) {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.data = data ?? new Uint8Array();
    this.size = this.data.byteLength;
  }
}

export class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  entries: Map<string, File | Directory>;

  constructor(public name: string) {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.entries = new Map();
  }
}

type Entry = File | Directory;

export class MemFS implements vscode.FileSystemProvider {
  private root = new Directory('');
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  stat(uri: vscode.Uri): vscode.FileStat {
    return this._lookup(uri, false);
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const entry = this._lookupAsDirectory(uri, false);
    const result: [string, vscode.FileType][] = [];
    for (const [name, child] of entry.entries) {
      result.push([name, child.type]);
    }
    return result;
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const entry = this._lookupAsFile(uri, false);
    return entry.data;
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
    const basename = this._basename(uri.path);
    const parent = this._lookupParentDirectory(uri);

    let entry = parent.entries.get(basename);
    if (entry instanceof Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (!entry && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (entry && options.create && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }

    if (!entry) {
      entry = new File(basename, content);
      parent.entries.set(basename, entry);
      this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
    } else {
      (entry as File).mtime = Date.now();
      (entry as File).size = content.byteLength;
      (entry as File).data = content;
      this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }
  }

  createDirectory(uri: vscode.Uri): void {
    const basename = this._basename(uri.path);
    const parent = this._lookupParentDirectory(uri);

    const entry = new Directory(basename);
    parent.entries.set(basename, entry);
    parent.mtime = Date.now();
    parent.size += 1;
    this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  delete(uri: vscode.Uri): void {
    const dirname = uri.with({ path: this._dirname(uri.path) });
    const basename = this._basename(uri.path);
    const parent = this._lookupAsDirectory(dirname, false);
    if (!parent.entries.has(basename)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    parent.entries.delete(basename);
    parent.mtime = Date.now();
    parent.size -= 1;
    this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('Rename not supported');
  }

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  // -- helpers

  /** Ensure all parent directories exist for a given path, then write the file. */
  seedFile(path: string, content: Uint8Array): void {
    const parts = path.split('/').filter(Boolean);
    let current = this.root;

    // Create intermediate directories
    for (let i = 0; i < parts.length - 1; i++) {
      let child = current.entries.get(parts[i]);
      if (!child) {
        child = new Directory(parts[i]);
        current.entries.set(parts[i], child);
      }
      if (child instanceof Directory) {
        current = child;
      }
    }

    // Create the file
    const fileName = parts[parts.length - 1];
    const file = new File(fileName, content);
    current.entries.set(fileName, file);
  }

  private _lookup(uri: vscode.Uri, silent: false): Entry;
  private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
  private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
    const parts = uri.path.split('/').filter(Boolean);
    let entry: Entry = this.root;

    for (const part of parts) {
      if (entry instanceof Directory) {
        const child = entry.entries.get(part);
        if (!child) {
          if (silent) { return undefined; }
          throw vscode.FileSystemError.FileNotFound(uri);
        }
        entry = child;
      } else {
        if (silent) { return undefined; }
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    }
    return entry;
  }

  private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw vscode.FileSystemError.FileNotADirectory(uri);
  }

  private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw vscode.FileSystemError.FileIsADirectory(uri);
  }

  private _lookupParentDirectory(uri: vscode.Uri): Directory {
    const dirname = uri.with({ path: this._dirname(uri.path) });
    return this._lookupAsDirectory(dirname, false);
  }

  private _basename(path: string): string {
    path = path.replace(/\/$/, '');
    return path.substring(path.lastIndexOf('/') + 1);
  }

  private _dirname(path: string): string {
    path = path.replace(/\/$/, '');
    const last = path.lastIndexOf('/');
    return last === -1 ? '/' : path.substring(0, last || 1);
  }
}
