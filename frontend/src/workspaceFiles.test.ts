import { describe, expect, it } from "vitest";
import { SOURCE_ACCEPT, isSupportedSourceName, sourceTypeForName } from "./workspaceFiles";

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
