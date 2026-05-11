"use client";

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
  window.addEventListener("online", () => {
    navigator.serviceWorker.controller?.postMessage("wq-drain");
  });
}
