import { useState, useEffect } from 'react';
import Toggle from '../../components/ToggleSwitch';
import { useDevMode } from '../../context/DevModeContext';

const isElectron = Boolean(window.echo?.pickFolder);

const PathSetting = ({ label, description, storageKey, defaultValue, electronGetter }) => {
  const [value, setValue] = useState(() => localStorage.getItem(storageKey) || '');

  // Seed from Electron on first load if localStorage is empty
  useEffect(() => {
    if (localStorage.getItem(storageKey)) return; // already set
    if (electronGetter && window.echo?.[electronGetter]) {
      window.echo[electronGetter]().then((p) => {
        if (p) { setValue(p); localStorage.setItem(storageKey, p); }
        else    { setValue(defaultValue); }
      }).catch(() => setValue(defaultValue));
    } else {
      setValue(defaultValue);
    }
  }, []);

  const handleChange = (v) => {
    setValue(v);
    localStorage.setItem(storageKey, v);
  };

  const handleBrowse = async () => {
    const picked = await window.echo.pickFolder(value || undefined);
    if (picked) handleChange(picked);
  };

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-echo-border-2">
      <div className="mb-1">
        <p className="text-sm font-ui font-semibold text-white">{label}</p>
        <p className="text-[10px] text-echo-dim font-body mt-0.5">{description}</p>
      </div>
      <div className="flex gap-1">
        <input
          value={value}
          onChange={e => handleChange(e.target.value)}
          className="flex-1 bg-echo-surface-2 border border-echo-border text-white text-xs px-3 py-2 focus:border-echo-green font-body truncate"
          spellCheck={false}
        />
        {isElectron && (
          <button
            onClick={handleBrowse}
            className="px-3 py-2 text-[9px] font-ui font-semibold tracking-widest uppercase border border-echo-border text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
          >
            Browse
          </button>
        )}
      </div>
    </div>
  );
};

const Settings = () => {
  const { devMode, setDevMode } = useDevMode();

  return (
    <div className="h-full w-full overflow-auto bg-echo-bg p-8">
      <div className="max-w-xl">
        <div className="border border-echo-border bg-echo-surface p-5 flex flex-col gap-0 mb-4">
          <h2 className="text-[9px] font-ui font-bold uppercase tracking-widest text-echo-muted mb-2">Application</h2>
          <div className="flex items-center justify-between py-3 border-b border-echo-border-2">
            <div>
              <p className="text-sm font-ui font-semibold text-white">Development Mode</p>
              <p className="text-[10px] text-echo-dim font-body mt-0.5">Shows backend console in the sidebar</p>
            </div>
            <Toggle checked={devMode} onChange={() => setDevMode(!devMode)} />
          </div>
        </div>

        <div className="border border-echo-border bg-echo-surface p-5">
          <h2 className="text-[9px] font-ui font-bold uppercase tracking-widest text-echo-muted mb-2">Default Paths</h2>
          <PathSetting
            label="Trained Models Directory"
            description="Where trained ML models are saved by default."
            storageKey="echo_models_dir"
            defaultValue="backend/ml_models"
            electronGetter="getDefaultModelPath"
          />
          <PathSetting
            label="Session Recordings Directory"
            description="Where sensor session recordings are saved by default."
            storageKey="echo_recordings_dir"
            defaultValue="backend/recordings"
            electronGetter="getDefaultRecordingPath"
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;