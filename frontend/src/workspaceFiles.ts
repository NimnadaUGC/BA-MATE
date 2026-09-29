import { get, set } from "idb-keyval";
import { api } from "./api";
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

declare global {
  interface Window {
    baMateDesktop?: {
      chooseProjectFolder: () => Promise<{ name: string; path: string } | null>;
    };
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

const browserHandleKey = (id: string) => `ba-mate-project-folder:${id}`;

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
  return "TXT";
};

export async function chooseProjectFolder(): Promise<WorkspaceCandidate | null> {
  if (window.baMateDesktop) {
    const selected = await window.baMateDesktop.chooseProjectFolder();
    return selected ? { kind: "native", ...selected } : null;
  }
  if (!window.showDirectoryPicker) {
    throw new Error("Direct folder selection is unavailable here. BA Mate can still create a managed local project folder.");
  }
  const handle = await window.showDirectoryPicker();
  return { kind: "browser", name: handle.name, handle };
}

export async function createProjectWorkspace(
  projectId: string,
  projectName: string,
  candidate?: WorkspaceCandidate,
): Promise<WorkspaceReference> {
  if (candidate?.kind === "browser") {
    const workspaceId = crypto.randomUUID();
    await set(browserHandleKey(workspaceId), candidate.handle);
    await candidate.handle.getDirectoryHandle("sources", { create: true });
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
  const clean = relativePath.replaceAll("\\", "/").split("/").filter(part => part && part !== "." && part !== "..");
  if (!clean.length) throw new Error("A selected source has an invalid file name.");
  let directory = await root.getDirectoryHandle("sources", { create: true });
  for (const part of clean.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
  const name = clean.at(-1)!;
  return { directory, name };
}

async function writeBrowserFiles(workspaceId: string, files: StoredFile[]) {
  const root = await get<FileSystemDirectoryHandle>(browserHandleKey(workspaceId));
  if (!root) throw new Error("This project folder is no longer connected. Choose it again.");
  const permission = await root.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("Write access to the project folder was not granted.");
  for (const file of files) {
    const { directory, name } = await browserDestination(root, file.relativePath || file.name);
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
  }
}

export async function writeProjectFiles(reference: WorkspaceReference, files: StoredFile[]) {
  if (!files.length) return;
  if (reference.workspaceKind === "browser") {
    await writeBrowserFiles(reference.workspaceId, files);
    return;
  }
  await api(`/api/project-folders/${reference.workspaceId}/files`, {
    method: "POST",
    body: JSON.stringify({ files: files.map(file => ({ name: file.name, relative_path: file.relativePath, data: file.data })) }),
  });
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
