import { describe, expect, it } from "vitest";
import { seedState } from "./data";
import { goalSelectableSource, goalSourceCurrent, mergeProjectAnalysis, surfaceBackgroundQuestion } from "./projectSources";

const project = () => structuredClone(seedState.projects[0]);

describe("background project source discovery", () => {
  it("excludes an old approval without a verifiable folder revision from new goals", () => {
    const source = project().sources[0];
    source.approved = true;
    source.status = "Analyzed";
    source.relativePath = "Interviews/notes.txt";
    source.sha256 = undefined;
    expect(goalSelectableSource(source)).toBe(false);
    source.sha256 = "reviewed-revision";
    expect(goalSelectableSource(source)).toBe(true);
    const goal = project().goals[0];
    goal.sourceIds = [source.id];
    goal.sourceRevisionPins = { [source.id]: "reviewed-revision" };
    expect(goalSourceCurrent(goal, source)).toBe(true);
    source.sha256 = "changed-revision";
    expect(goalSourceCurrent(goal, source)).toBe(false);
    source.status = "Needs review";
    expect(goalSelectableSource(source)).toBe(false);
  });

  it("finishes queued setup extraction without treating it as a changed source", () => {
    const current = project();
    current.sources = [{ id: "SRC-queued", name: "notes.txt", type: "TXT", relativePath: "Uploaded Sources/notes.txt",
      status: "Needs review", classification: "Project only", provenance: "Added during setup", concepts: [],
      approved: false, immutable: true, version: 1 }];
    mergeProjectAnalysis(current, { status: "ready", sources: {
      "Uploaded Sources/notes.txt": { relative_path: "Uploaded Sources/notes.txt", signature: "1:2:20",
        status: "needs_review", name: "notes.txt", sha256: "first", content: "Newly extracted note", passages: [] },
    } });
    expect(current.sources).toHaveLength(1);
    expect(current.sources[0].version).toBe(2);
    expect(current.audit[0].action).toBe("Source analyzed for review");
  });

  it("adds nested files as unreviewed sources and keeps repeated scans stable", () => {
    const current = project();
    const analysis = { status: "ready" as const, sources: {
      "Interviews/notes.txt": { relative_path: "Interviews/notes.txt", signature: "1:20", status: "needs_review" as const,
        name: "notes.txt", sha256: "first", content: "Tentative interview text", passages: [{ locator: "Block 1", text: "Tentative interview text" }], limitations: [] },
    } };
    expect(mergeProjectAnalysis(current, analysis)).toBe(true);
    const discovered = current.sources.find(source => source.relativePath === "Interviews/notes.txt")!;
    expect(discovered.approved).toBe(false);
    expect(discovered.status).toBe("Needs review");
    expect(mergeProjectAnalysis(current, analysis)).toBe(false);
  });

  it("revokes approval when the original file changes", () => {
    const current = project();
    const source = current.sources[0];
    source.relativePath = "Uploaded Sources/policy.pdf";
    source.analysisSignature = "1:10";
    source.sha256 = "old";
    source.originalBase64 = "b2xk";
    source.approved = true;
    const changed = mergeProjectAnalysis(current, { status: "ready", sources: {
      "Uploaded Sources/policy.pdf": { relative_path: "Uploaded Sources/policy.pdf", signature: "2:11", status: "needs_review",
        name: "policy.pdf", sha256: "new", content: "Changed policy", passages: [], limitations: [] },
    } });
    expect(changed).toBe(true);
    expect(source.approved).toBe(false);
    expect(source.status).toBe("Needs review");
    expect(source.originalBase64).toBeUndefined();
  });

  it("asks one background clarification in chat without confirming or repeating it", () => {
    const current = project();
    const goal = current.goals.find(item => item.id === current.activeGoalId)!;
    const conversation = current.conversations.find(item => item.id === goal.conversationId)!;
    const initialCount = conversation.messages.length;
    const run: NonNullable<typeof current.agentRun> = { signature: "revision-1", status: "ready",
      requires_human_acceptance: true, roles: {
        planning: { status: "ready", proposal: { clarification_questions: ["Who approves the handoff?", "When is it due?"] } },
      } };
    expect(surfaceBackgroundQuestion(current, run)).toBe(true);
    expect(conversation.messages).toHaveLength(initialCount + 1);
    const asked = conversation.messages.at(-1)!;
    expect(asked.proposal?.after).toBe("Who approves the handoff?");
    expect(asked.proposal?.target).toBe(goal.id);
    expect(asked.proposal?.status).toBe("pending");
    expect(current.clarifications.some(item => item.question === asked.proposal?.after)).toBe(false);
    expect(surfaceBackgroundQuestion(current, run)).toBe(true);
    expect(conversation.messages.at(-1)?.proposal?.after).toBe("When is it due?");
    expect(surfaceBackgroundQuestion(current, run)).toBe(false);
  });
});
