import { describe, expect, it } from "vitest";
import { searchSourcePassages } from "./sourceSearch";
import { freshState } from "./store";

describe("source search", () => {
  it("finds phrases across extracted whitespace and ligatures without changing the original passage", () => {
    const source = freshState().projects[0].sources[0];
    const original = `Long introduction ${"x".repeat(100)} split  \n payment and ofﬁce`;
    source.passages = [{ locator: "Page 3", text: original }];
    const result = searchSourcePassages([source], "split payment");
    expect(result).toHaveLength(1);
    expect(result[0].match.toLowerCase()).toBe("split payment");
    expect(result[0].before.startsWith("…")).toBe(true);
    expect(result[0].passage.text).toBe(original);
    expect(searchSourcePassages([source], "office")).toHaveLength(1);
  });
  it("labels filename matches and does not return unrelated passages", () => {
    const source = freshState().projects[0].sources[0];
    source.name = "Inventory.pdf"; source.passages = [{ locator: "Page 1", text: "Unrelated text" }];
    expect(searchSourcePassages([source], "inventory")[0].nameMatch).toBe(true);
    expect(searchSourcePassages([source], "missing phrase")).toEqual([]);
  });
});
