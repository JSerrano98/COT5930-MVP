// components/Toggle.jsx
const Toggle = ({ checked, onChange, color = 'bg-green-500' }) => (
  <button
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-colors ${
      checked ? color : 'bg-gray-300'
    }`}
  >
    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
      checked ? 'translate-x-5' : ''
    }`} />
  </button>
);

export default Toggle;