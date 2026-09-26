import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initInstallPrompt, initViewportVars, isNative, hideNativeSplash } from "./game/android";

// Android / PWA boot setup
initViewportVars();
initInstallPrompt();

// Register service worker for offline play (web PWA only — native APK bundles assets locally)
if (!isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // SW optional — game still works without it
    });
  });
}

// Kill double-tap zoom + gesture zoom on Android Chrome
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
// Prevent pull-to-refresh / overscroll navigation
document.addEventListener('touchmove', (e) => {
  const t = e.target as HTMLElement | null;
  if (t?.closest?.('[data-scroll]')) return; // allow scroll in modal lists
}, { passive: true });

// Remove boot splash once React mounts
function removeSplash() {
  const s = document.getElementById('boot-splash');
  if (s) {
    s.style.opacity = '0';
    setTimeout(() => s.remove(), 450);
  }
  // Also dismiss the native Capacitor splash in APK builds
  void hideNativeSplash();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

requestAnimationFrame(() => setTimeout(removeSplash, 300));
