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
  private readonly queues = new Map<string, Promise<boolean>>();
  private readonly creations = new Map<string, Promise<boolean>>();

  enqueue(
    mutation: LineMutation,
    persist: () => Promise<boolean>,
    reorder: (payload: { lineIds: string[] }) => Promise<boolean>,
  ): Promise<boolean> {
    const lineKey = `line:${mutation.sheetId}:${mutation.lineId}`;
    const previous = this.queues.get(lineKey) ?? Promise.resolve(true);
    const content = previous.catch(() => false).then(persist);
    this.queues.set(lineKey, content);
    if (mutation.isNew) this.creations.set(lineKey, content);

    const result = content.then(async (saved) => {
      if (!saved || sameOrder(mutation.previousLineIds, mutation.lineIds)) return saved;

      // Snapshot this list: order requests contain stable ids only, and must not
      // observe later optimistic changes to the logbook object.
      const lineIds = [...mutation.lineIds];
      const dependencies = lineIds
        .map((lineId) => this.creations.get(`line:${mutation.sheetId}:${lineId}`))
        .filter((promise): promise is Promise<boolean> => Boolean(promise));
      const orderKey = `line-order:${mutation.sheetId}`;
      const previousOrder = this.queues.get(orderKey) ?? Promise.resolve(true);
      const order = previousOrder.catch(() => false).then(async () => {
        const created = await Promise.all(dependencies);
        return created.every(Boolean) ? reorder({ lineIds }) : false;
      });
      this.queues.set(orderKey, order);
      const ordered = await order;
      if (this.queues.get(orderKey) === order) this.queues.delete(orderKey);
      return ordered;
    });

    void result.finally(() => {
      if (this.queues.get(lineKey) === content) this.queues.delete(lineKey);
      if (mutation.isNew && this.creations.get(lineKey) === content) this.creations.delete(lineKey);
    });
    return result;
  }

  clear() {
    this.queues.clear();
    this.creations.clear();
  }
}
