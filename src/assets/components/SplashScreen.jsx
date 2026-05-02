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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-echo-surface"
      style={{
        transition: `opacity ${FADE_MS}ms ease`,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Corner accent lines */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-echo-green" />
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-echo-green" />
      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-echo-green" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-echo-green" />

      <div className="mb-8 flex flex-col items-center gap-2">
        <h1
          className="text-[5.5rem] leading-none tracking-[0.12em] text-white font-title"
        >
          ECHO
        </h1>
        <div className="w-full h-px bg-echo-border" />
        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-echo-muted font-ui">
          Enhanced Cognitive Human Operations
        </p>
      </div>

      <div
        className="mb-4 h-8 w-8 border-2"
        style={{
          animation: 'echo-spin 0.8s linear infinite',
          borderColor: 'rgba(255, 122, 0, 0.25)',
          borderTopColor: '#FF7A00', 
        }}
      />
      <p className="text-xs tracking-widest uppercase text-echo-dim font-ui">{status}</p>
    </div>
  );
};

export default SplashScreen;
