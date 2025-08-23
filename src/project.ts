import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface ProjectInfo {
  projectId: string;
  projectName: string;
  // Enhanced for global database
  globalProjectId: string; // Git-based, machine-independent
  localProjectId: string; // Machine-specific for local storage
  projectPath: string; // For local reference
  gitOriginUrl?: string; // For team collaboration
  repositoryName?: string; // Extracted from git URL
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

function extractRepositoryName(gitUrl: string): string {
  // Extract repo name from various Git URL formats
  const patterns = [
    /github\.com[\/:]([^\/]+)\/([^\/\.]+)/, // GitHub
    /gitlab\.com[\/:]([^\/]+)\/([^\/\.]+)/, // GitLab
    /bitbucket\.org[\/:]([^\/]+)\/([^\/\.]+)/, // Bitbucket
    /[\/:]([^\/]+)\/([^\/\.]+)$/, // Generic
  ];

  for (const pattern of patterns) {
    const match = gitUrl.match(pattern);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }

  // Fallback: extract last two path segments
  const parts = gitUrl.replace(/\.git$/, "").split("/");
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }

  return gitUrl;
}

export async function getProjectInfo(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<ProjectInfo> {
  const packageName = await getPackageJsonName(workspaceFolder);
  const gitOrigin = await getGitOriginUrl(workspaceFolder);
  const projectPath = workspaceFolder.uri.fsPath;

  // Global Project ID: Git-based, machine-independent (for team collaboration)
  let globalProjectId: string;
  let repositoryName: string | undefined;

  if (gitOrigin) {
    repositoryName = extractRepositoryName(gitOrigin);
    // Use git origin + package name for global identification
    globalProjectId = simpleHash(`git:${gitOrigin}|${packageName}`);
  } else {
    // Fallback: use package name only (less precise but still useful)
    globalProjectId = simpleHash(`pkg:${packageName}`);
  }

  // Local Project ID: Machine-specific (for local storage and disambiguation)
  const localProjectId = simpleHash(`local:${projectPath}|${packageName}`);

  // Backward compatibility: use globalProjectId as main projectId
  const projectId = globalProjectId;

  return {
    projectId,
    projectName: packageName,
    globalProjectId,
    localProjectId,
    projectPath,
    gitOriginUrl: gitOrigin || undefined,
    repositoryName,
  };
}
