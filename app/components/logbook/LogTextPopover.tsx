"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ModalLayer } from "./ModalLayer";

/** Link only HTTP(S) text; leave other user-entered content as escaped text. */
export function LinkedLogText({ text }: { text: string }) {
  const known = new Map([
    ["Weather data by Open-Meteo.com (https://open-meteo.com/)", ["Weather data by Open-Meteo.com", "https://open-meteo.com/"]],
    ["CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)", ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"]],
  ]);
  const tokens = /Weather data by Open-Meteo\.com \(https:\/\/open-meteo\.com\/\)|CC BY 4\.0 \(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/\)|https?:\/\/[^\s<>()\[\]]+/g;
  const content = [];
  let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    content.push(text.slice(cursor, match.index));
    const pair = known.get(match[0]);
    const href = pair?.[1] ?? match[0].replace(/[.,;:!?]+$/, "");
    const suffix = pair ? "" : match[0].slice(href.length);
    content.push(<a key={match.index} href={href} target="_blank" rel="noopener noreferrer">{pair?.[0] ?? href}</a>, suffix);
    cursor = match.index + match[0].length;
  }
  content.push(text.slice(cursor));
  return <>{content}</>;
}

export function LogTextPopover({ label, text }: { label: string; text: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const keepOpen = () => { clearTimeout(closeTimer.current); };
  const show = () => { keepOpen(); setOpen(true); };
  const delayClose = () => { keepOpen(); closeTimer.current = setTimeout(() => setOpen(false), 180); };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const bubble = panel.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(anchor.right - bubble.width, window.innerWidth - bubble.width - 8));
      const below = anchor.bottom + 6;
      const top = Math.max(8, Math.min(below + bubble.height <= window.innerHeight - 8 ? below : anchor.top - bubble.height - 6, window.innerHeight - bubble.height - 8));
      setPosition(previous => previous.left === left && previous.top === top ? previous : { left, top });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      keepOpen();
      trigger.current?.focus();
      setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="log-line-text-tooltip" aria-label={`${label}: ${text}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onMouseEnter={show} onMouseLeave={delayClose} onFocus={show} onBlur={delayClose} onClick={show}>
      <span aria-hidden="true">ⓘ</span>
    </button>
    {open && <ModalLayer>
      <div ref={panel} id={id} className="log-line-text-tooltip-bubble" role="dialog" aria-label={label} style={position}
        onMouseEnter={keepOpen} onMouseLeave={delayClose} onFocus={keepOpen} onBlur={delayClose}>
        <LinkedLogText text={text} />
      </div>
    </ModalLayer>}
  </>;
}
