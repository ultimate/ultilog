import { describe, expect, it } from "vitest";
import { filterAndSortItems } from "../../app/components/logbook/SortableList";

const items = [
  { name: "Zephyr", port: "Hamburg", miles: 12 },
  { name: "Aurora", port: "Kiel", miles: 105 },
  { name: "Borealis", port: "Hamburg", miles: 9 },
];
const columns = [
  { key: "name", value: (item: typeof items[number]) => item.name },
  { key: "port", value: (item: typeof items[number]) => item.port },
  { key: "miles", value: (item: typeof items[number]) => item.miles },
];

describe("filterAndSortItems", () => {
  it("searches every configured displayed column case-insensitively", () => {
    expect(filterAndSortItems(items, columns, "HAMBURG", "", "ascending").map((item) => item.name))
      .toEqual(["Zephyr", "Borealis"]);
  });

  it("sorts text and numeric columns in either direction", () => {
    expect(filterAndSortItems(items, columns, "", "name", "ascending").map((item) => item.name))
      .toEqual(["Aurora", "Borealis", "Zephyr"]);
    expect(filterAndSortItems(items, columns, "", "miles", "descending").map((item) => item.miles))
      .toEqual([105, 12, 9]);
  });
});
