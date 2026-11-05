"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Keep client-only actions disabled until their event handlers are attached. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}
