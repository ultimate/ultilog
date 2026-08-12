import { describe, expect, it, vi } from "vitest";
import { LineMutationQueue } from "../../app/components/logbook/line-mutation-queue";

const deferred = () => {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { promise, resolve };
};

const mutation = (lineId: string, overrides: Partial<Parameters<LineMutationQueue["enqueue"]>[0]> = {}) => ({
  sheetId: "sheet-1",
  lineId,
  isNew: false,
  previousLineIds: [lineId],
  lineIds: [lineId],
  ...overrides,
});

describe("line mutation queue", () => {
  it("allows edits to different stable line ids to proceed independently", async () => {
    const queue = new LineMutationQueue();
    const first = deferred();
    const secondPersist = vi.fn().mockResolvedValue(true);
    const firstSave = queue.enqueue(mutation("line-a"), () => first.promise, vi.fn());
    const secondSave = queue.enqueue(mutation("line-b"), secondPersist, vi.fn());

    await secondSave;
    expect(secondPersist).toHaveBeenCalledOnce();
    first.resolve(true);
    await firstSave;
  });

  it("keeps rapid edits to one stable line ordered", async () => {
    const queue = new LineMutationQueue();
    const first = deferred();
    const events: string[] = [];
    const firstSave = queue.enqueue(mutation("line-a"), async () => { events.push("first"); return first.promise; }, vi.fn());
    const secondSave = queue.enqueue(mutation("line-a"), async () => { events.push("second"); return true; }, vi.fn());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["first"]);
    first.resolve(true);
    await Promise.all([firstSave, secondSave]);
    expect(events).toEqual(["first", "second"]);
  });

  it("waits for every referenced creation before sending stable-id order", async () => {
    const queue = new LineMutationQueue();
    const creation = deferred();
    const reorder = vi.fn().mockResolvedValue(true);
    const createSave = queue.enqueue(mutation("line-new", {
      isNew: true,
      previousLineIds: ["line-old"],
      lineIds: ["line-old", "line-new"],
    }), () => creation.promise, reorder);

    await Promise.resolve();
    expect(reorder).not.toHaveBeenCalled();
    creation.resolve(true);
    await createSave;
    expect(reorder).toHaveBeenCalledWith({ lineIds: ["line-old", "line-new"] });
  });

  it("does not persist an order snapshot after a failed content mutation", async () => {
    const queue = new LineMutationQueue();
    const reorder = vi.fn();
    const saved = await queue.enqueue(mutation("line-a", {
      previousLineIds: ["line-a", "line-b"],
      lineIds: ["line-b", "line-a"],
    }), async () => false, reorder);

    expect(saved).toBe(false);
    expect(reorder).not.toHaveBeenCalled();
  });
});
