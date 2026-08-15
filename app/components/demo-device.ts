const DEMO_DEVICE_ID_KEY = "ultilog.demo-device-id";

/** Returns a stable, opaque browser-installation id for demo abuse controls. */
export function demoDeviceId(storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage) {
  const existing = storage.getItem(DEMO_DEVICE_ID_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(DEMO_DEVICE_ID_KEY, created);
  return created;
}
