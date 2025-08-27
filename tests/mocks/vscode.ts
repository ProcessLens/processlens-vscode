// Mock VS Code API for testing
export const Uri = {
  file: (path: string) => ({ fsPath: path }),
  parse: (uri: string) => ({ fsPath: uri }),
};

export const workspace = {
  getConfiguration: () => ({
    get: (key: string) => undefined,
    update: () => Promise.resolve(),
  }),
  workspaceFolders: [],
  fs: {
    createDirectory: () => Promise.resolve(),
    writeFile: () => Promise.resolve(),
    readFile: () => Promise.resolve(new Uint8Array()),
    stat: () => Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 }),
    readDirectory: () => Promise.resolve([]),
    delete: () => Promise.resolve(),
  },
};

export const window = {
  showInformationMessage: () => Promise.resolve(),
  showWarningMessage: () => Promise.resolve(),
  showErrorMessage: () => Promise.resolve(),
  createWebviewPanel: () => ({}),
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(),
};

export const ExtensionContext = class {
  subscriptions: any[] = [];
  globalStorageUri = { fsPath: "/tmp/test-storage" };
  extensionUri = { fsPath: "/tmp/test-extension" };
};

export const Disposable = class {
  static from(...disposables: any[]) {
    return { dispose: () => {} };
  }
};

export const ViewColumn = {
  One: 1,
  Two: 2,
  Three: 3,
};

export const WebviewOptions = {};
export const WebviewPanelOptions = {};
