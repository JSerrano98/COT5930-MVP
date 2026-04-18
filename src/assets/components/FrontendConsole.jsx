import { useEffect, useRef, useState } from 'react';

const LEVEL_STYLE = {
  log:   'text-slate-300',
  info:  'text-blue-400',
  warn:  'text-yellow-400',
  error: 'text-red-400',
};

const FrontendConsole = () => {
  const [entries, setEntries] = useState([]);
  const bottomRef = useRef(null);
  const originals = useRef({});

  // Intercept console methods
  useEffect(() => {
    const levels = ['log', 'info', 'warn', 'error'];

    levels.forEach((level) => {
      originals.current[level] = console[level].bind(console);
      console[level] = (...args) => {
        originals.current[level](...args);
        const msg = args
          .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        setEntries((prev) => {
          const next = [...prev, { level, msg }];
          return next.length > 300 ? next.slice(-300) : next;
        });
      };
    });

    return () => {
      levels.forEach((level) => {
        console[level] = originals.current[level];
      });
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Frontend</span>
        <button
          onClick={() => setEntries([])}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          title="Clear"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950 rounded p-1.5 font-mono text-xs min-h-0 mt-1">
        {entries.length === 0 ? (
          <span className="text-slate-600 italic">No output yet…</span>
        ) : (
          entries.map((e, i) => (
            <div key={i} className={`leading-relaxed whitespace-pre-wrap break-all ${LEVEL_STYLE[e.level]}`}>
              {e.msg}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default FrontendConsole;
