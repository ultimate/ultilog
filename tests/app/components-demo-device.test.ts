import { describe, expect, it, vi } from "vitest";
import { demoDeviceId } from "../../app/components/demo-device";

describe("demoDeviceId", () => {
  it("creates and reuses a browser-specific demo identifier", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "device-1") });

    expect(demoDeviceId(storage)).toBe("device-1");
    expect(demoDeviceId(storage)).toBe("device-1");
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
});
