import { useEffect, useRef, useState } from 'react';

const BACKEND = 'http://localhost:8000';
const FADE_MS = 400;

/**
 * SplashScreen
 *
 * In Electron: listens for startup events from the main process.
 *   Main handles: backend start → session start → emits startup:ready
 *   Splash just shows progress and dismisses when ready fires.
 *
 * In browser (dev without Electron): falls back to polling /health.
 */
const SplashScreen = ({ onReady }) => {
  const [status, setStatus] = useState('Starting…');
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStatus('Ready');
    setFading(true);
    setTimeout(onReady, FADE_MS);
  };

  useEffect(() => {
    // ── Electron path ────────────────────────────────────────────────────────
    if (window.echo?.onStartupReady) {
      // Main process may have already finished before this component mounted
      // (e.g. HMR reload). Check current status immediately.
      window.echo.getStartupStatus().then(({ done, sessionRunning }) => {
        if (done) {
          finish();
          return;
        }
        // Not done — subscribe to progress events
        window.echo.onStartupStatus((msg) => setStatus(msg));
        window.echo.onStartupReady(() => finish());
      });
      return;
    }

    // ── Browser fallback: poll /health ───────────────────────────────────────
    let cancelled = false;
    setStatus('Waiting for backend…');

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) { finish(); return; }
        } catch { /* still waiting */ }
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    poll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-100"
      style={{
        transition: `opacity ${FADE_MS}ms ease`,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <div className="mb-8 flex flex-col items-center gap-1">
        <h1
          className="text-7xl tracking-[0.08em] text-stone-900"
          style={{ fontFamily: '"Bebas Neue", sans-serif' }}
        >
          ECHO
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
          Enhanced Cognitive Human Operations
        </p>
      </div>

      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-500" />
      <p className="text-sm text-stone-500">{status}</p>
    </div>
  );
};

export default SplashScreen;
