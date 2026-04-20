import { useEffect, useRef } from 'react';
import { useDevMode } from '../context/DevModeContext';

// Map a log line to a Tailwind text color class based on log level keywords
const lineColor = (line) => {
  const u = line.toUpperCase();
  if (/\bCRITICAL\b|\bFATAL\b/.test(u))     return 'text-red-400 font-semibold';
  if (/\bERROR\b|\bTraceback\b|\bException\b/.test(u)) return 'text-red-400';
  if (/\bWARNING\b|\bWARN\b/.test(u))        return 'text-amber-400';
  if (/\bINFO\b/.test(u))                    return 'text-cyan-400';
  if (/\bDEBUG\b/.test(u))                   return 'text-slate-500';
  if (/\bOK\b|\b200\b|\bsuccess\b/i.test(u)) return 'text-emerald-400';
  return 'text-slate-200';
};

const BackendConsole = () => {
  const { backendLogs } = useDevMode();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [backendLogs]);

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Backend</span>
        <span className="text-xs text-slate-600">{backendLogs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950 rounded p-1.5 font-mono text-[11px] leading-relaxed min-h-0 mt-1">
        {!window.echo ? (
          <span className="text-slate-600 italic">Electron only</span>
        ) : backendLogs.length === 0 ? (
          <span className="text-slate-600 italic">No logs yet…</span>
        ) : (
          backendLogs.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${lineColor(line)}`}>
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default BackendConsole;
