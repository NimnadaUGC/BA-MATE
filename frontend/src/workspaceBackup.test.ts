import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { api } from "./api";
import { freshState, IndexedDbWorkspaceRepository, recordsOnlyRecoveryProject } from "./store";
import { copyProjectToWorkspace, missingRestoredOriginalCount, prepareProjectBackup, reattachSourceOriginal, restoreProjectWorkspace, verifyGoalSourceOriginals, writeProjectFiles } from "./workspaceFiles";
import { verifyBaselineSources } from "./baselineSources";
import { applyProposal, evidenceFingerprint, type SavedRun } from "./workflow";

vi.mock("./api", () => ({ api: vi.fn(), importSource: vi.fn() }));
const request = vi.mocked(api);

describe("portable project folders", () => {
  beforeEach(() => { request.mockReset(); });

  it("versions multi-passage backups so older importers can reject them and still reads older packages", async () => {
    const project = structuredClone(freshState().projects[0]);
    const link = project.traceLinks[0];
    link.sourcePassages = [{ sourceId: project.sources[0].id, sourceRevision: 1, locator: "Page 2" }, { sourceId: project.sources[0].id, sourceRevision: 1, locator: "Page 3" }];
    const repository = new IndexedDbWorkspaceRepository();
    const blob = await repository.exportProject(project);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const envelope = JSON.parse(await zip.file("ba-mate-project.json")!.async("string"));
    expect(envelope.formatVersion).toBe(4);
    expect(envelope.schemaVersion).toBe(8);
    const imported = await repository.importProject(await blob.arrayBuffer() as unknown as File);
    expect(imported.traceLinks[0].sourcePassages).toEqual(link.sourcePassages);

    const makePackage = async (formatVersion: number, schemaVersion: number) => {
      const archive = new JSZip();
      archive.file("ba-mate-project.json", JSON.stringify({ ...envelope, formatVersion, schemaVersion }));
      return await archive.generateAsync({ type: "uint8array" }) as unknown as File;
    };
    expect((await repository.importProject(await makePackage(3, 7))).traceLinks[0].sourcePassages).toEqual(link.sourcePassages);
    await expect(repository.importProject(await makePackage(5, 9))).rejects.toThrow(/newer BA Mate version/i);
  });

  it("restores unsaved records from a recovery copy without claiming source originals", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.description = 'Unsaved simulation edit'; project.cloudAllowed = true;
    project.sources = [{ id: 'SRC-test', name: 'notes.txt', type: 'TXT', originalBase64: 'bm90ZXM=',
      status: 'Analyzed', classification: 'Project only', provenance: 'Test', concepts: [], approved: true, immutable: true }];
    const before = structuredClone(project);
    const repository = new IndexedDbWorkspaceRepository();
    const zip = await repository.exportProject(recordsOnlyRecoveryProject(project));
    const imported = await repository.importProject(await zip.arrayBuffer() as unknown as File);
    request.mockResolvedValue({ workspace_id: 'recovery', folder_name: 'recovery', display_path: '/tmp/recovery', kind: 'managed' });
    const restored = await restoreProjectWorkspace(imported);
    expect(restored.name).toBe(`${project.name} — recovered records`);
    expect(restored.description).toBe('Unsaved simulation edit');
    expect(restored.sources[0].approved).toBe(false);
    expect(restored.sources[0].status).toBe('Needs review');
    expect(restored.sources[0].originalBase64).toBeUndefined();
    expect(restored.cloudAllowed).toBe(false);
    expect(project).toEqual(before);
  });

  it("keeps pending proposals reviewable after a complete restore and rejects them after evidence changes", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.sources = [];
    for (const goal of project.goals) { goal.sourceIds = []; goal.sourceRevisionPins = {}; }
    project.aiRuns = [];
    const run = { id: "synthetic-pending", at: "", goalId: project.activeGoalId, status: "pending", fingerprint: evidenceFingerprint(project),
      proposal: { summary: "Synthetic", questions: [{ question: "Which test rule applies?", rationale: "Review", priority: "Important", source_ids: ["PROJECT-BRIEF"] }], requirements: [], stories: [], findings: [], diagrams: [], sections: [], limitations: [] },
      metadata: { request_id: "synthetic-pending", provider: "test", model: "test", framework_version: "test", prompt_version: "test", condition: "Proposed workflow", task: "clarify", elapsed_ms: 0, usage: { input_tokens: 0, output_tokens: 0, cost: null }, temperature: 0, context_tokens: 100, output_tokens: 20, retries: 0, context_hash: "" },
      receipt: { included_reference_ids: ["PROJECT-BRIEF"], omitted_reference_ids: [], partial_reference_ids: [], context_hash: "" } } as SavedRun;
    project.aiRuns.push(run);
    const repository = new IndexedDbWorkspaceRepository();
    const blob = await repository.exportProject(project);
    const imported = await repository.importProject(await blob.arrayBuffer() as unknown as File);
    request.mockResolvedValue({ workspace_id: "restored", folder_name: "restored", display_path: "/tmp/restored", kind: "managed" });
    const restored = await restoreProjectWorkspace(imported);
    expect(restored.id).not.toBe(project.id);
    expect(restored.aiRuns?.[0].status).toBe("pending");
    const changed = structuredClone(restored); changed.description += " Changed evidence.";
    expect(() => applyProposal(changed, run.id, ["questions:0"], run.proposal)).toThrow(/changed/);
    expect(changed.clarifications.some(item => item.question === "Which test rule applies?")).toBe(false);
    applyProposal(restored, run.id, ["questions:0"], run.proposal);
    expect(restored.aiRuns?.[0].status).toBe("accepted");
    expect(restored.clarifications.at(-1)?.status).toBe("Unanswered");
    expect(project.aiRuns[0].status).toBe("pending");
  });

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
    expect(missingRestoredOriginalCount(restored)).toBe(0);
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
    expect(missingRestoredOriginalCount(restored)).toBe(1);
  });

  it("identifies a partial restore folder when writing an original fails", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.workspaceFolders = [];
    project.sources = [{ id: "SRC-test", name: "notes.txt", type: "TXT", relativePath: "notes.txt",
      originalBase64: "bm90ZXM=", status: "Needs review", classification: "Project only",
      provenance: "Test", concepts: [], approved: false, immutable: true }];
    request.mockImplementation(async path => {
      if (path === "/api/project-folders") return { workspace_id: "partial", folder_name: "partial", display_path: "/tmp/partial-restore", kind: "managed" };
      if (path === "/api/project-folders/partial/files") throw new Error("Disk is full");
      throw new Error(`Unexpected request: ${path}`);
    });
    await expect(restoreProjectWorkspace(project)).rejects.toThrow(/Disk is full.*partial project folder.*\/tmp\/partial-restore.*not removed/);
  });

  it("does not silently accept an incomplete file-write receipt", async () => {
    request.mockResolvedValue({ written: [] });
    await expect(writeProjectFiles({ workspaceId: 'folder', workspaceKind: 'managed', folderName: 'test' }, [{ name: 'note.txt', data: 'bm90ZXM=' }])).rejects.toThrow('did not confirm every copied file');
  });

  it("reports the destination if reconnecting fails after folder creation", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.workspaceId = undefined; project.workspaceKind = undefined; project.workspaceFolders = [];
    project.sources = [{ id: 'SRC-test', name: 'notes.txt', type: 'TXT', originalBase64: 'bm90ZXM=', status: 'Needs review', classification: 'Project only', provenance: 'Test', concepts: [], approved: false, immutable: true }];
    request.mockImplementation(async path => {
      if (path === '/api/project-folders') return { workspace_id: 'new-folder', folder_name: 'destination', display_path: '/tmp/destination', kind: 'managed' };
      if (path === '/api/project-folders/new-folder/files') throw new Error('Write failed');
      throw new Error(`Unexpected request: ${path}`);
    });
    await expect(copyProjectToWorkspace(project, { kind: 'managed', path: '/tmp/destination' } as never)).rejects.toThrow(/Write failed.*\/tmp\/destination.*original project was not changed/);
    expect(project.workspaceId).toBeUndefined();
    expect(project.sources[0].originalBase64).toBe('bm90ZXM=');
  });

  it("withdraws goal revision selection when an original is absent from the backup", async () => {
    const project = structuredClone(freshState().projects[0]);
    const source = project.sources[0], goal = project.goals[0];
    source.originalBase64 = undefined; source.sha256 = 'old-hash'; source.relativePath = 'old.txt';
    goal.sourceIds = [source.id]; goal.sourceRevisionPins = { [source.id]: 'old-hash' };
    request.mockResolvedValue({ workspace_id: 'new-workspace', folder_name: 'restored', display_path: '/tmp/restored', kind: 'managed' });
    const restored = await restoreProjectWorkspace(project);
    expect(restored.goals[0].sourceIds).toContain(source.id);
    expect(restored.goals[0].sourceRevisionPins?.[source.id]).toBeUndefined();
    expect(restored.sources[0].approved).toBe(false);
  });

  it("reattaches only an exact matching original without accepting it automatically", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.workspaceId = 'folder'; project.workspaceKind = 'managed';
    const source = project.sources[0]; source.relativePath = undefined; source.originalBase64 = undefined;
    source.approved = false; source.status = 'Needs review'; source.sha256 = 'ab5aa97074c454a0632057e704220d9a6678fbf773a0a5806fc09b8173b07309';
    const file = { name: 'notes.txt', size: 5 } as File;
    vi.stubGlobal('FileReader', class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() { this.result = 'data:text/plain;base64,bm90ZXM='; this.onload?.(); }
    });
    request.mockResolvedValue({ written: ['Uploaded Sources/notes.txt'] });
    expect(await reattachSourceOriginal(project, source, file)).toBe('Uploaded Sources/notes.txt');
    expect(source.approved).toBe(false);
    source.sha256 = 'different';
    request.mockClear();
    await expect(reattachSourceOriginal(project, source, file)).rejects.toThrow('does not match');
    expect(request).not.toHaveBeenCalled();
    source.sha256 = undefined;
    await expect(reattachSourceOriginal(project, source, file)).rejects.toThrow('no recorded file hash');
    vi.unstubAllGlobals();
  });

  it("rejects a package whose original differs from its recorded source revision", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.sources = [{ id: "SRC-1", name: "notes.txt", type: "TXT", relativePath: "notes.txt",
      originalBase64: "bm90ZXM=", sha256: "wrong-hash", status: "Analyzed", classification: "Project only",
      provenance: "Backup", concepts: [], approved: true, immutable: true }];
    await expect(restoreProjectWorkspace(project)).rejects.toThrow("does not match its recorded source hash");
    expect(request).not.toHaveBeenCalled();
  });

  it("checks selected original bytes before AI even when the saved source record still looks current", async () => {
    const project = structuredClone(freshState().projects[0]);
    const source = project.sources[0], goal = project.goals[0];
    project.workspaceId = 'folder'; project.workspaceKind = 'managed';
    goal.sourceIds = [source.id]; goal.sourceRevisionPins = { [source.id]: 'ab5aa97074c454a0632057e704220d9a6678fbf773a0a5806fc09b8173b07309' };
    source.sha256 = goal.sourceRevisionPins[source.id]; source.relativePath = 'notes.txt'; source.approved = true; source.status = 'Analyzed';
    request.mockResolvedValue({ name: 'notes.txt', data: 'bm90ZXM=' });
    await expect(verifyGoalSourceOriginals(project)).resolves.toBeUndefined();
    request.mockResolvedValue({ name: 'notes.txt', data: 'Y2hhbmdlZA==' });
    await expect(verifyGoalSourceOriginals(project)).rejects.toThrow('original changed since extraction');
    goal.sourceRevisionPins[source.id] = 'older';
    request.mockClear();
    await expect(verifyGoalSourceOriginals(project)).rejects.toThrow('Review and select current revisions');
    expect(request).not.toHaveBeenCalled();
  });

  it("checks sources of another goal when its artifact is included in a baseline", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.workspaceId = 'folder'; project.workspaceKind = 'managed';
    const hash = 'ab5aa97074c454a0632057e704220d9a6678fbf773a0a5806fc09b8173b07309';
    const first = { ...project.sources[0], id: 'SRC-active', name: 'active.txt', relativePath: 'active.txt', sha256: hash, status: 'Analyzed' as const, approved: true };
    const second = { ...first, id: 'SRC-other', name: 'other.txt', relativePath: 'other.txt' };
    project.sources = [first, second];
    const goal = project.goals[0]; goal.sourceIds = [first.id]; goal.sourceRevisionPins = { [first.id]: hash };
    const otherGoal = { ...structuredClone(goal), id: 'other-goal', sourceIds: [second.id], sourceRevisionPins: { [second.id]: hash } };
    project.goals.push(otherGoal); project.activeGoalId = goal.id;
    const requirement = project.requirements[0]; requirement.goalId = otherGoal.id;
    const document = project.documents[0]; document.goalId = goal.id;
    document.sections = [document.sections[0]]; document.sections[0].linkedIds = [requirement.id];
    document.sections[0].blocks = []; project.requirements = [requirement]; project.stories = []; project.diagrams = []; project.changes = [];
    request.mockImplementation(async path => ({ name: 'test', data: path.includes('other.txt') ? 'Y2hhbmdlZA==' : 'bm90ZXM=' }));
    await expect(verifyBaselineSources(project, goal.id)).rejects.toThrow('other.txt: The original changed');
    expect(request.mock.calls.some(([path]) => path.includes('active.txt'))).toBe(true);
    expect(request.mock.calls.some(([path]) => path.includes('other.txt'))).toBe(true);
  });

  it("checks a manually linked source even if it is outside the goal's AI source selection", async () => {
    const project = structuredClone(freshState().projects[0]);
    project.workspaceId = 'folder'; project.workspaceKind = 'managed';
    const goal = project.goals[0]; project.activeGoalId = goal.id; goal.sourceIds = []; goal.sourceRevisionPins = {};
    const source = project.sources[0];
    source.id = 'SRC-manual'; source.name = 'manual.txt'; source.relativePath = 'manual.txt'; source.sha256 = 'ab5aa97074c454a0632057e704220d9a6678fbf773a0a5806fc09b8173b07309';
    source.status = 'Analyzed'; source.approved = true;
    const requirement = project.requirements[0]; requirement.goalId = goal.id; requirement.sourceIds = [];
    project.requirements = [requirement]; project.stories = []; project.documents = []; project.diagrams = []; project.changes = [];
    project.traceLinks = [{ id: 'manual-link', from: source.id, to: requirement.id, relation: 'supports', status: 'Verified', fromRevision: source.version ?? 1, toRevision: requirement.version }];
    request.mockResolvedValue({ name: 'manual.txt', data: 'Y2hhbmdlZA==' });
    await expect(verifyBaselineSources(project, goal.id)).rejects.toThrow('manual.txt: The original changed');
    source.approved = false;
    await expect(verifyBaselineSources(project, goal.id)).rejects.toThrow('Review and accept this referenced source');
    project.sources = [];
    await expect(verifyBaselineSources(project, goal.id)).rejects.toThrow('Evidence records are missing: SRC-manual');
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
