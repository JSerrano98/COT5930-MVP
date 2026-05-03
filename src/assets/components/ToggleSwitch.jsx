const Toggle = ({ checked, onChange }) => (
  <button
    onClick={onChange}
    className={`relative w-11 h-6 transition-colors border ${
      checked ? 'bg-echo-green/20 border-echo-green' : 'bg-echo-surface-2 border-echo-border'
    }`}
  >
    <div className={`absolute top-0.5 left-0.5 w-5 h-5 transition-transform ${
      checked ? 'translate-x-5 bg-echo-green' : 'bg-echo-dim'
    }`} />
  </button>
);

export default Toggle;