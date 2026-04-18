import Toggle from '../../components/ToggleSwitch';
import { useDevMode } from '../../context/DevModeContext';

const Settings = () => {
  const { devMode, setDevMode } = useDevMode();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="flex items-center gap-3">
        <span>Development Mode</span>
        <Toggle checked={devMode} onChange={() => setDevMode(!devMode)} />
      </div>
    </div>
  );
};

export default Settings;