import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface ProjectInfo {
  projectId: string;
  projectName: string;
}

function simpleHash(input: string): string {
  // Simple FNV-1a hash with salt
  const salt = "processlens2024";
  const hashInput = salt + input;
  let hash = 2166136261;
  for (let i = 0; i < hashInput.length; i++) {
    hash ^= hashInput.charCodeAt(i);
    hash *= 16777619;
  }
  return (hash >>> 0).toString(16);
}

async function getGitOriginUrl(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<string | null> {
  try {
    const gitConfigPath = path.join(
      workspaceFolder.uri.fsPath,
      ".git",
      "config"
    );
    const configContent = await fs.promises.readFile(gitConfigPath, "utf8");

    // Simple regex to extract origin URL
    const originMatch = configContent.match(
      /\[remote "origin"\]\s*\n\s*url\s*=\s*(.+)/
    );
    if (originMatch) {
      let url = originMatch[1].trim();
      // Normalize GitHub URLs
      url = url.replace(/^git@github\.com:/, "https://github.com/");
      url = url.replace(/\.git$/, "");
      return url;
    }
  } catch {
    // Git config not found or not readable
  }
  return null;
}

async function getPackageJsonName(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<string> {
  try {
    const pkgPath = path.join(workspaceFolder.uri.fsPath, "package.json");
    const content = await fs.promises.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    return pkg.name || path.basename(workspaceFolder.uri.fsPath);
  } catch {
    return path.basename(workspaceFolder.uri.fsPath);
  }
}

export async function getProjectInfo(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<ProjectInfo> {
  const packageName = await getPackageJsonName(workspaceFolder);
  const gitOrigin = await getGitOriginUrl(workspaceFolder);

  let projectId: string;
  if (gitOrigin) {
    projectId = simpleHash(gitOrigin + "|" + packageName);
  } else {
    projectId = simpleHash(workspaceFolder.uri.fsPath + "|" + packageName);
  }

  return {
    projectId,
    projectName: packageName,
  };
}
