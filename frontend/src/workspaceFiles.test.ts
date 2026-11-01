import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { SOURCE_ACCEPT, chooseProjectFolder, isSupportedSourceName, sourceTypeForName } from "./workspaceFiles";

vi.mock("./api", () => ({ api: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("project source file support", () => {
  it("advertises every format handled by the importer", () => {
    for (const extension of [".pdf", ".docx", ".md", ".csv", ".xlsx", ".xls", ".png", ".mp3", ".wav", ".mp4"]) {
      expect(SOURCE_ACCEPT).toContain(extension);
    }
  });

  it("classifies spreadsheets and media without mislabelling them as PDFs", () => {
    expect(sourceTypeForName("requirements.XLSX")).toBe("Spreadsheet");
    expect(sourceTypeForName("interview.mp3")).toBe("Audio");
    expect(sourceTypeForName("walkthrough.mp4")).toBe("Video");
    expect(sourceTypeForName("notes.csv")).toBe("Spreadsheet");
    expect(sourceTypeForName("readme.md")).toBe("TXT");
    expect(isSupportedSourceName("VOICE.M4A")).toBe(true);
    expect(isSupportedSourceName(".DS_Store")).toBe(false);
  });
});

describe("existing project folder selection", () => {
  it("uses the local folder dialog when the browser has no directory picker", async () => {
    vi.stubGlobal("window", {});
    vi.mocked(api).mockResolvedValue({ name: "Existing project", path: "/tmp/Existing project" });
    await expect(chooseProjectFolder()).resolves.toEqual({ kind: "native", name: "Existing project", path: "/tmp/Existing project" });
    expect(api).toHaveBeenCalledWith("/api/project-folders/choose", { method: "POST" });
  });

  it("leaves the selection unchanged when the local dialog is canceled", async () => {
    vi.stubGlobal("window", {});
    vi.mocked(api).mockResolvedValue(null);
    await expect(chooseProjectFolder()).resolves.toBeNull();
  });
});
