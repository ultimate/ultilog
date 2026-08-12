import { describe, expect, it } from "vitest";
import { mergeMutationResult } from "../../app/components/logbook/mutation-merge";

describe("focused mutation response merging", () => {
  const original = { id: "boat-1", name: "First", homePort: "A", revision: 0, createdAt: "created", updatedAt: "created" };

  it("uses returned revisions for two consecutive edits without reloading", () => {
    const firstDraft = { ...original, name: "Second" };
    const first = mergeMutationResult(firstDraft, firstDraft, { ...original, name: "SECOND", revision: 1, updatedAt: "one" });
    const secondDraft = { ...first, name: "Third" };
    const second = mergeMutationResult(secondDraft, secondDraft, { ...secondDraft, name: "THIRD", revision: 2, updatedAt: "two" });

    expect(first).toMatchObject({ name: "SECOND", revision: 1, updatedAt: "one" });
    expect(second).toMatchObject({ name: "THIRD", revision: 2, updatedAt: "two" });
  });

  it("does not overwrite a later local field when an earlier response is delayed", () => {
    const submitted = { ...original, name: "Second", homePort: "B" };
    const current = { ...submitted, name: "Third" };

    expect(mergeMutationResult(current, submitted, { ...submitted, name: "SECOND", homePort: "B!", revision: 1, updatedAt: "one" }))
      .toMatchObject({ name: "Third", homePort: "B!", revision: 1, updatedAt: "one" });
  });

  it("can apply a later successful response after an earlier request failed", () => {
    const laterDraft = { ...original, name: "Third" };
    // A failed response is intentionally not merged.
    const result = mergeMutationResult(laterDraft, laterDraft, { ...laterDraft, name: "THIRD", revision: 1, updatedAt: "later" });

    expect(result).toMatchObject({ name: "THIRD", revision: 1, updatedAt: "later" });
  });
});
