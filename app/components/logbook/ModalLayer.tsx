"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
const getTarget = () => document.querySelector(".app-shell") ?? document.body;
const getServerTarget = () => null;

/** Escape filtered content cards while preserving the shell's theme variables. */
export function ModalLayer(props: ComponentProps<"div">) {
  const target = useSyncExternalStore(subscribe, getTarget, getServerTarget);
  return target ? createPortal(<div {...props} />, target) : null;
}
