export type LineMutation = {
  sheetId: string;
  lineId: string;
  isNew: boolean;
  previousLineIds: string[];
  lineIds: string[];
};

const sameOrder = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

/** Coordinates focused line writes without turning them back into sheet snapshots. */
export class LineMutationQueue {
  private readonly pending = new Set<Promise<boolean>>();
  private readonly queues = new Map<string, Promise<boolean>>();

  enqueue(
    mutation: LineMutation,
    persist: () => Promise<boolean>,
    reorder: (payload: { lineIds: string[] }) => Promise<boolean>,
  ): Promise<boolean> {
    // Creating a line changes the complete ID set required by the reorder API.
    // Keep content and order in one sheet transaction queue so a later creation
    // cannot reach the server before an earlier order snapshot is applied.
    const sheetKey = mutation.sheetId;
    const previous = this.queues.get(sheetKey) ?? Promise.resolve(true);
    const lineIds = [...mutation.lineIds];
    const result = previous.catch(() => false).then(async () => {
      const saved = await persist();
      if (!saved || sameOrder(mutation.previousLineIds, lineIds)) return saved;
      return reorder({ lineIds });
    }).catch(() => false);
    this.queues.set(sheetKey, result);

    this.pending.add(result);
    void result.finally(() => {
      this.pending.delete(result);
      if (this.queues.get(sheetKey) === result) this.queues.delete(sheetKey);
    });
    return result;
  }

  async drain() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  clear() {
    this.queues.clear();
  }
}
