"use client";

import * as React from "react";

export function NoInspectGuard() {
  React.useEffect(() => {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      trace: console.trace,
    };

    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.debug = () => {};
    console.trace = () => {};

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const preventShortcuts = (event: KeyboardEvent) => {
      const rawKey = typeof event.key === "string" ? event.key : "";
      if (!rawKey) return;

      const key = rawKey.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      const blocked =
        key === "f12" ||
        (ctrlOrMeta && event.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (ctrlOrMeta && key === "u");

      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("keydown", preventShortcuts, true);

    return () => {
      window.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("keydown", preventShortcuts, true);

      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
      console.trace = originalConsole.trace;
    };
  }, []);

  return null;
}
