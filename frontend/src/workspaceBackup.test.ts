import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { freshState } from "./store";
import { prepareProjectBackup, restoreProjectWorkspace, writeProjectFiles } from "./workspaceFiles";

vi.mock("./api", () => ({ api: vi.fn(), importSource: vi.fn() }));
const request = vi.mocked(api);

describe("portable project folders", () => {
  beforeEach(() => { request.mockReset(); });

  it("includes a discovered nested original without changing the live project", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.workspaceId = "workspace-1";
    project.workspaceKind = "managed";
    project.sources = [{ id: "SRC-1", name: "notes.txt", type: "TXT", relativePath: "Interviews/notes.txt",
      status: "Needs review", classification: "Project only", provenance: "Folder", concepts: [], approved: false, immutable: true }];
    request.mockImplementation(async path => path.includes("/history")
      ? [{ signature: "old-run", status: "ready", roles: {}, requires_human_acceptance: true }]
      : { name: "notes.txt", data: "bm90ZXM=" });

    const backup = await prepareProjectBackup(project);
    expect(backup.sources[0].originalBase64).toBe("bm90ZXM=");
    expect(backup.agentHistory?.[0].signature).toBe("old-run");
    expect(project.sources[0].originalBase64).toBeUndefined();
    expect(project.agentHistory).toBeUndefined();
    expect(request).toHaveBeenCalledWith("/api/project-folders/workspace-1/file?relative_path=Interviews%2Fnotes.txt");
  });

  it("restores nested originals into a fresh managed folder", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.id = "restored-1";
    project.workspaceFolders = ["Interviews"];
    project.agentRun = { signature: "backed-up-run", status: "ready", roles: {
      planning: { status: "ready", proposal: { summary: "Keep this original proposal" } },
    }, requires_human_acceptance: true };
    project.sources = [{ id: "SRC-1", name: "notes.txt", type: "TXT", relativePath: "Interviews/notes.txt",
      originalBase64: "bm90ZXM=", status: "Needs review", classification: "Project only", provenance: "Folder",
      concepts: [], approved: false, immutable: true }];
    request.mockImplementation(async path => {
      if (path === "/api/project-folders") return { workspace_id: "new-workspace", folder_name: "restored-folder", display_path: "/tmp/restored-folder", kind: "managed" };
      if (path === "/api/project-folders/new-workspace/directories") return { created: ["Interviews"] };
      if (path === "/api/project-folders/new-workspace/files") return { written: ["Interviews/notes.txt"] };
      throw new Error(`Unexpected request: ${path}`);
    });

    const restored = await restoreProjectWorkspace(project);
    expect(restored.workspaceId).toBe("new-workspace");
    expect(restored.workspacePath).toBe("/tmp/restored-folder");
    expect(restored.sources[0].relativePath).toBe("Interviews/notes.txt");
    expect(restored.sources[0].originalBase64).toBeUndefined();
    expect(restored.agentRun).toBeUndefined();
    expect(restored.agentHistory?.at(-1)?.signature).toBe("backed-up-run");
    expect(restored.agentHistory?.at(-1)?.roles.planning.proposal?.summary).toBe("Keep this original proposal");
    expect(request.mock.calls.some(([path, options]) => path === "/api/project-folders/new-workspace/files" &&
      options?.body === JSON.stringify({ files: [{ name: "notes.txt", relative_path: "Interviews/notes.txt", data: "bm90ZXM=" }] }))).toBe(true);
  });

  it("keeps older source records but withdraws approval when the original is absent", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.sources = [{ id: "SRC-legacy", name: "old-note", type: "TXT", status: "Analyzed",
      classification: "Project only", provenance: "Older workspace", concepts: [], approved: true, immutable: true }];
    request.mockImplementation(async path => path.includes("/history") ? [] : { workspace_id: "new-workspace", folder_name: "restored-folder",
      display_path: "/tmp/restored-folder", kind: "managed" });
    const backup = await prepareProjectBackup(project);
    const restored = await restoreProjectWorkspace(backup);
    expect(restored.sources[0].approved).toBe(false);
    expect(restored.sources[0].status).toBe("Needs review");
    expect(restored.sources[0].extractionLimitations?.[0]).toContain("original file is unavailable");
  });

  it("rejects a package whose original differs from its recorded source revision", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.sources = [{ id: "SRC-1", name: "notes.txt", type: "TXT", relativePath: "notes.txt",
      originalBase64: "bm90ZXM=", sha256: "wrong-hash", status: "Analyzed", classification: "Project only",
      provenance: "Backup", concepts: [], approved: true, immutable: true }];
    await expect(restoreProjectWorkspace(project)).rejects.toThrow("does not match its recorded source hash");
    expect(request).not.toHaveBeenCalled();
  });

  it("copies multiple uploads in bounded requests", async () => {
    request.mockImplementation(async (_path, options) => {
      const files = JSON.parse(String(options?.body)).files as { name: string }[];
      return { written: files.map(file => `Uploaded Sources/${file.name}`) };
    });
    const files = Array.from({ length: 5 }, (_, index) => ({ name: `note-${index}.txt`, data: "bm90ZXM=" }));
    const written = await writeProjectFiles({ workspaceId: "workspace-1", workspaceKind: "managed", folderName: "project" }, files);
    expect(request).toHaveBeenCalledTimes(2);
    expect(written).toHaveLength(5);
  });
});
