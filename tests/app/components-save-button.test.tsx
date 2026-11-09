import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { SaveButton, SavingContext, usePendingSaves } from "../../app/components/logbook/SaveButton";
vi.mock("../../app/lib/i18n", () => ({ useI18n: () => ({ t: () => "Saving…" }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("blocks same-form duplicate submits, allows other forms and resets after failure", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const action = vi.fn(async () => { await gate; throw new Error("Failed"); });
  let submit!: (key: string) => Promise<unknown>;
  function Harness() {
    const saves = usePendingSaves();
    submit = key => saves.run(key, action);
    return <SavingContext.Provider value={saves.pending}><SaveButton saveKey="one">Save one</SaveButton><SaveButton saveKey="two">Save two</SaveButton></SavingContext.Provider>;
  }
  let root!: ReactTestRenderer;
  await act(async () => { root = create(<Harness />); });
  let first!: Promise<unknown>;
  await act(async () => { first = submit("one").catch(error => error.message); await submit("one"); });
  expect(action).toHaveBeenCalledTimes(1);
  expect(root.root.findAllByType("button").map(button => button.props.disabled)).toEqual([true, false]);
  let second!: Promise<unknown>;
  await act(async () => { second = submit("two").catch(error => error.message); });
  expect(action).toHaveBeenCalledTimes(2);
  await act(async () => { release(); expect(await first).toBe("Failed"); await second; });
  expect(root.root.findAllByType("button").every(button => !button.props.disabled)).toBe(true);
  await act(async () => root.unmount());
});
