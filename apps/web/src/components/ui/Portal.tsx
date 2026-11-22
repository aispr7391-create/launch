"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body>. Modals must escape their parents: an ancestor with
 * `backdrop-filter` (the sticky header) or `transform` (page animations) turns
 * `position: fixed` into "fixed to that ancestor", which clipped the wallet dialog.
 * Also locks page scrolling while open.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.body);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return target ? createPortal(children, target) : null;
}
