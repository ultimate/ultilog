"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "ultilog-cookie-notice-acknowledged";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(window.localStorage.getItem(CONSENT_KEY) !== "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!isVisible) return null;

  function acknowledge() {
    window.localStorage.setItem(CONSENT_KEY, "true");
    setIsVisible(false);
  }

  return (
    <aside className="cookie-banner" aria-label="Cookie notice" role="dialog" aria-live="polite">
      <div>
        <strong>Cookies aboard</strong>
        <p>
          Ultilog uses only cookies and local storage that are necessary to keep you signed in,
          remember your settings, and operate the service. We do not use advertising cookies.
          {" "}<Link href="/legal#privacy">Learn more</Link>
        </p>
      </div>
      <button type="button" onClick={acknowledge}>Got it</button>
    </aside>
  );
}
