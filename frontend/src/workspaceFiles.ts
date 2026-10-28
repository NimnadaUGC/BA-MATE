import { get, set } from "idb-keyval";
import { api, importSource } from "./api";
import type { Project, Source } from "./types";

const SOURCE_EXTENSIONS = [
  ".pdf", ".docx", ".txt", ".md", ".csv", ".json", ".xlsx", ".xls",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff",
  ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac",
  ".mp4", ".mov", ".m4v", ".webm", ".mkv",
];
export const SOURCE_ACCEPT = SOURCE_EXTENSIONS.join(",");
export const isSupportedSourceName = (name: string) => SOURCE_EXTENSIONS.some(extension => name.toLowerCase().endsWith(extension));

export type WorkspaceCandidate =
  | { kind: "native"; name: string; path: string }
  | { kind: "browser"; name: string; handle: FileSystemDirectoryHandle };

export type WorkspaceReference = {
  workspaceId: string;
  workspaceKind: "managed" | "selected" | "browser";
  folderName: string;
  displayPath?: string;
};

export type StoredFile = { name: string; relativePath?: string; data: string };
export type WorkspaceAnalysis = { status: "scanning" | "ready" | "failed"; sources: Record<string, {
  relative_path: string; signature?: string; status: "needs_review" | "unsupported" | "failed";
  name?: string; sha256?: string; content?: string; passages?: { locator: string; text: string }[];
  limitations?: string[]; error?: string;
}>; folders?: string[]; error?: string };

declare global {
  interface Window {
    baMateDesktop?: {
      chooseProjectFolder: () => Promise<{ name: string; path: string } | null>;
    };
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

const browserHandleKey = (id: string) => `ba-mate-project-folder:${id}`;
const browserExtractionCache = new Map<string, WorkspaceAnalysis["sources"][string]>();
const requestWorkspacePermission = (handle: FileSystemDirectoryHandle) =>
  (handle as FileSystemDirectoryHandle & { requestPermission(options: { mode: "readwrite" }): Promise<PermissionState> })
    .requestPermission({ mode: "readwrite" });

export const relativePathForFile = (file: File) =>
  (file.webkitRelativePath || file.name).replaceAll("\\", "/");

export const sourceTypeForName = (name: string): Source["type"] => {
  const suffix = name.toLowerCase().split(".").pop() ?? "";
  if (suffix === "pdf") return "PDF";
  if (suffix === "docx") return "DOCX";
  if (["csv", "xlsx", "xls"].includes(suffix)) return "Spreadsheet";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff"].includes(suffix)) return "Image";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(suffix)) return "Audio";
  if (["mp4", "mov", "m4v", "webm", "mkv"].includes(suffix)) return "Video";
  if (["txt", "md", "json"].includes(suffix)) return "TXT";
  return "Other";
};

export async function chooseProjectFolder(): Promise<WorkspaceCandidate | null> {
  if (window.baMateDesktop) {
    const selected = await window.baMateDesktop.chooseProjectFolder();
    return selected ? { kind: "native", ...selected } : null;
  }
  if (window.showDirectoryPicker) {
    const handle = await window.showDirectoryPicker();
    return { kind: "browser", name: handle.name, handle };
  }
  const selected = await api<{ name: string; path: string } | null>("/api/project-folders/choose", { method: "POST" });
  return selected ? { kind: "native", ...selected } : null;
}

export async function createProjectWorkspace(
  projectId: string,
  projectName: string,
  candidate?: WorkspaceCandidate,
): Promise<WorkspaceReference> {
  if (candidate?.kind === "browser") {
    const workspaceId = crypto.randomUUID();
    const permission = await requestWorkspacePermission(candidate.handle);
    if (permission !== "granted") throw new Error("Read and write access to the project folder is required.");
    await set(browserHandleKey(workspaceId), candidate.handle);
    await candidate.handle.getDirectoryHandle("Uploaded Sources", { create: true });
    return { workspaceId, workspaceKind: "browser", folderName: candidate.name };
  }
  const result = await api<{ workspace_id: string; folder_name: string; display_path: string; kind: "managed" | "selected" }>(
    "/api/project-folders",
    {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        project_name: projectName,
        selected_path: candidate?.kind === "native" ? candidate.path : undefined,
      }),
    },
  );
  return { workspaceId: result.workspace_id, workspaceKind: result.kind, folderName: result.folder_name, displayPath: result.display_path };
}

async function browserDestination(root: FileSystemDirectoryHandle, relativePath: string) {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error("A selected source has an invalid path.");
  const clean = parts;
  if (!clean.length) throw new Error("A selected source has an invalid file name.");
  let directory = root;
  for (const part of clean.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
  const name = clean.at(-1)!;
  return { directory, name, folderPath: clean.slice(0, -1).join("/") };
}

async function writeBrowserFiles(workspaceId: string, files: StoredFile[]) {
  const root = await get<FileSystemDirectoryHandle>(browserHandleKey(workspaceId));
  if (!root) throw new Error("This project folder is no longer connected. Choose it again.");
  const permission = await requestWorkspacePermission(root);
  if (permission !== "granted") throw new Error("Write access to the project folder was not granted.");
  const written: string[] = [];
  for (const file of files) {
    const { directory, name, folderPath } = await browserDestination(root, file.relativePath || `Uploaded Sources/${file.name}`);
    const bytes = Uint8Array.from(atob(file.data), character => character.charCodeAt(0));
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const suffix = dot > 0 ? name.slice(dot) : "";
    let destinationName = name;
    for (let index = 0; index < 1000; index += 1) {
      try {
        const existingHandle = await directory.getFileHandle(destinationName);
        const existing = new Uint8Array(await (await existingHandle.getFile()).arrayBuffer());
        if (existing.length === bytes.length && existing.every((value, byteIndex) => value === bytes[byteIndex])) break;
        destinationName = `${stem} (${index + 1})${suffix}`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") break;
        throw error;
      }
    }
    const handle = await directory.getFileHandle(destinationName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    written.push([folderPath, destinationName].filter(Boolean).join("/"));
  }
  return written;
}

export async function writeProjectFiles(reference: WorkspaceReference, files: StoredFile[]) {
  if (!files.length) return [] as string[];
  if (reference.workspaceKind === "browser") {
    return writeBrowserFiles(reference.workspaceId, files);
  }
  const written: string[] = [];
  // Keep each request well under the service's 150 MB decoded-batch limit.
  for (let index = 0; index < files.length; index += 4) {
    const batch = files.slice(index, index + 4);
    const result = await api<{ written: string[] }>(`/api/project-folders/${reference.workspaceId}/files`, {
      method: "POST",
      body: JSON.stringify({ files: batch.map(file => ({ name: file.name, relative_path: file.relativePath, data: file.data })) }),
    });
    written.push(...result.written);
  }
  return written;
}

export async function createProjectDirectories(reference: WorkspaceReference, folders: string[]) {
  if (!folders.length) return;
  if (reference.workspaceKind === "browser") {
    const root = await get<FileSystemDirectoryHandle>(browserHandleKey(reference.workspaceId));
    if (!root) throw new Error("This project folder is no longer connected. Choose it again.");
    const permission = await requestWorkspacePermission(root);
    if (permission !== "granted") throw new Error("Write access to the project folder was not granted.");
    for (const folder of folders) {
      let current = root;
      for (const part of folder.split("/")) {
        if (!part || part === "." || part === "..") throw new Error("A folder path is invalid.");
        current = await current.getDirectoryHandle(part, { create: true });
      }
    }
    return;
  }
  await api(`/api/project-folders/${reference.workspaceId}/directories`, { method: "POST", body: JSON.stringify({ folders }) });
}

export async function readFileForWorkspace(file: File): Promise<string> {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error(`${file.name} must be between 1 byte and 25 MB.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

export async function readProjectOriginal(reference: WorkspaceReference, relativePath: string): Promise<{ name: string; data: string }> {
  if (reference.workspaceKind !== "browser") return api(`/api/project-folders/${reference.workspaceId}/file?relative_path=${encodeURIComponent(relativePath)}`);
  const root = await get<FileSystemDirectoryHandle>(browserHandleKey(reference.workspaceId));
  if (!root) throw new Error("This project folder is no longer connected. Choose it again.");
  const parts = relativePath.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error("The source path is invalid.");
  let directory = root;
  for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
  const file = await (await directory.getFileHandle(parts.at(-1)!)).getFile();
  return { name: file.name, data: await readFileForWorkspace(file) };
}

export async function getProjectAnalysis(reference: WorkspaceReference): Promise<WorkspaceAnalysis> {
  if (reference.workspaceKind !== "browser") return api<WorkspaceAnalysis>(`/api/project-folders/${reference.workspaceId}/analysis`);
  const root = await get<FileSystemDirectoryHandle>(browserHandleKey(reference.workspaceId));
  if (!root) throw new Error("This project folder is no longer connected. Choose it again.");
  const permission = await requestWorkspacePermission(root);
  if (permission !== "granted") throw new Error("Read and write access to the project folder is required.");
  const sources: WorkspaceAnalysis["sources"] = {};
  const folders: string[] = [];
  const visit = async (directory: FileSystemDirectoryHandle, prefix = "") => {
    const entries = (directory as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> }).values();
    for await (const entry of entries) {
      if (entry.name.startsWith(".") || ["node_modules", "__pycache__"].includes(entry.name)) continue;
      const path = `${prefix}${entry.name}`;
      if (entry.kind === "directory") { folders.push(path); await visit(entry as FileSystemDirectoryHandle, `${path}/`); }
      else {
        const file = await (entry as FileSystemFileHandle).getFile();
        const signature = `${file.lastModified}:${file.size}`;
        const cacheKey = `${reference.workspaceId}:${path}`;
        const cached = browserExtractionCache.get(cacheKey);
        if (cached?.signature === signature && cached.status !== "failed") { sources[path] = cached; continue; }
        if (!isSupportedSourceName(entry.name)) {
          sources[path] = { relative_path: path, signature, status: "unsupported", name: entry.name,
            error: "This format is retained in the project folder but cannot be extracted yet." };
          browserExtractionCache.set(cacheKey, sources[path]);
          continue;
        }
        if (!file.size || file.size > 25 * 1024 * 1024) {
          sources[path] = { relative_path: path, signature, status: "unsupported", name: entry.name,
            error: "Files must be between 1 byte and 25 MB." };
          continue;
        }
        try {
          const result = await importSource(file);
          sources[path] = { relative_path: path, signature, status: "needs_review", name: entry.name,
            sha256: result.sha256, content: result.content, passages: result.passages, limitations: result.limitations };
        } catch (error) {
          sources[path] = { relative_path: path, signature, status: "failed", name: entry.name,
            error: error instanceof Error ? error.message : "Extraction failed." };
        }
        browserExtractionCache.set(cacheKey, sources[path]);
      }
    }
  };
  await visit(root);
  return { status: "ready", sources, folders };
}

export async function ensureProjectWorkspace(project: Project, candidate?: WorkspaceCandidate) {
  if (!candidate && project.workspaceId && project.workspaceKind) {
    return { workspaceId: project.workspaceId, workspaceKind: project.workspaceKind, folderName: project.folderName, displayPath: project.workspacePath } satisfies WorkspaceReference;
  }
  return createProjectWorkspace(project.id, project.name, candidate);
}

export const sourceStoredFile = (source: Source): StoredFile | null => source.originalBase64
  ? { name: source.name, relativePath: source.relativePath, data: source.originalBase64 }
  : null;

async function hashOriginal(data: string): Promise<string> {
  const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function verifySourceOriginal(project: Project, source: Source): Promise<void> {
  if (!source.sha256) throw new Error("This source has no verified extraction. Wait for analysis before including it as evidence.");
  const original = source.relativePath && project.workspaceId && project.workspaceKind
    ? await readProjectOriginal({ workspaceId: project.workspaceId, workspaceKind: project.workspaceKind,
      folderName: project.folderName, displayPath: project.workspacePath }, source.relativePath)
    : source.originalBase64 ? { data: source.originalBase64 } : null;
  if (!original) throw new Error("The original source is unavailable. Reconnect its project folder before approval.");
  if (await hashOriginal(original.data) !== source.sha256)
    throw new Error("The original changed since extraction. Wait for BA Mate to refresh it, then review the new revision.");
}

/** Include originals discovered in connected folders before making a portable backup. */
export async function prepareProjectBackup(project: Project): Promise<Project> {
  const backup = structuredClone(project);
  for (const source of backup.sources) {
    if (!source.relativePath || !backup.workspaceId || !backup.workspaceKind) {
      if (source.originalBase64) {
        if (source.sha256 && await hashOriginal(source.originalBase64) !== source.sha256)
          throw new Error(`A complete backup cannot include ${source.name}: its original does not match the recorded source hash.`);
        continue;
      }
      // Older demonstration workspaces retained extraction and provenance but
      // never stored the original bytes. Keep their metadata without inventing a file.
      continue;
    }
    try {
      const original = await readProjectOriginal({
        workspaceId: backup.workspaceId,
        workspaceKind: backup.workspaceKind,
        folderName: backup.folderName,
        displayPath: backup.workspacePath,
      }, source.relativePath);
      if (source.sha256) {
        const digest = await hashOriginal(original.data);
        if (digest !== source.sha256) throw new Error("The folder file changed since the last source scan. Wait for BA Mate to refresh it, then retry.");
      }
      source.originalBase64 = original.data;
    } catch (error) {
      if (source.status === "Excluded") { source.originalBase64 = undefined; continue; }
      const reason = error instanceof Error ? error.message : "The original could not be read.";
      throw new Error(`A complete backup cannot include ${source.relativePath}: ${reason}`);
    }
  }
  if (backup.workspaceId) {
    const priorRuns = await api<NonNullable<Project["agentRun"]>[]>(`/api/project-agents/${encodeURIComponent(backup.workspaceId)}/history`);
    backup.agentHistory = [...(backup.agentHistory ?? []), ...priorRuns];
  }
  return backup;
}

function archiveCurrentAgentRun(project: Project): void {
  if (!project.agentRun) return;
  project.agentHistory = [...(project.agentHistory ?? []), project.agentRun];
  project.agentRun = undefined;
}

/** Materialize the originals in a fresh managed folder when importing a package. */
export async function restoreProjectWorkspace(project: Project): Promise<Project> {
  for (const source of project.sources) {
    if (!source.originalBase64) continue;
    try {
      const digest = await hashOriginal(source.originalBase64);
      if (source.sha256 && digest !== source.sha256) throw new Error(`The original for ${source.name} does not match its recorded source hash.`);
      if (!source.sha256) { source.approved = false; source.status = "Needs review"; source.sha256 = digest; }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : `The original for ${source.name} is invalid.`);
    }
  }
  const reference = await createProjectWorkspace(project.id, project.name);
  await createProjectDirectories(reference, project.workspaceFolders ?? []);
  for (const source of project.sources) {
    const original = sourceStoredFile(source);
    if (!original) {
      source.relativePath = undefined;
      source.approved = false;
      if (source.status !== "Excluded") source.status = "Needs review";
      source.extractionLimitations = [...(source.extractionLimitations ?? []), "The original file is unavailable in this backup. Review the recorded extraction before reuse."];
      continue;
    }
    const written = await writeProjectFiles(reference, [original]);
    source.relativePath = written[0];
    source.originalBase64 = undefined;
  }
  archiveCurrentAgentRun(project);
  project.workspaceId = reference.workspaceId;
  project.workspaceKind = reference.workspaceKind;
  project.workspacePath = reference.displayPath;
  project.folderName = reference.folderName;
  return project;
}

/** Copy the full source tree when the BA connects a different project folder. */
export async function copyProjectToWorkspace(project: Project, candidate: WorkspaceCandidate): Promise<Project> {
  const copy = await prepareProjectBackup(project);
  const reference = await createProjectWorkspace(project.id, project.name, candidate);
  await createProjectDirectories(reference, copy.workspaceFolders ?? []);
  for (const source of copy.sources) {
    const original = sourceStoredFile(source);
    if (!original) {
      source.relativePath = undefined;
      source.approved = false;
      if (source.status !== "Excluded") source.status = "Needs review";
      continue;
    }
    const written = await writeProjectFiles(reference, [original]);
    source.relativePath = written[0];
    source.originalBase64 = undefined;
  }
  archiveCurrentAgentRun(copy);
  copy.workspaceId = reference.workspaceId;
  copy.workspaceKind = reference.workspaceKind;
  copy.workspacePath = reference.displayPath;
  copy.folderName = reference.folderName;
  return copy;
}
