import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { EmbedCodeBuilder } from "../../app/components/logbook/EmbedCodeBuilder";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("embed code builder", () => {
  let root: ReactTestRenderer | undefined;

  afterEach(() => {
    root?.unmount();
  });

  it("keeps the selected color after the change event has been released", async () => {
    await act(async () => { root = create(<EmbedCodeBuilder shareUrl="https://ultilog.test/share/owner/sheet" enabled />); });

    const colorInput = root!.root.findAllByType("input")[0];
    const event = { currentTarget: { value: "#123456" } };
    await act(async () => {
      colorInput.props.onChange(event);
      // This mirrors React releasing the synthetic event after the handler.
      event.currentTarget = null as unknown as { value: string };
    });

    expect(root!.root.findByType("textarea").props.value).toContain("bg=%23123456");
  });
});
