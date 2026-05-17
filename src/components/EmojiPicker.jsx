import { useEffect, useRef } from 'react';

const EMOJIS = [
  '🧳','👶','🎒','🏠','⛺','🐾','✈️','🚗','🎡','🎪',
  '🏖️','🏔️','🎿','🏕️','🛒','🧺','🎁','🎉','🏡','🌊',
  '🌲','❄️','☀️','🌈','🍔','🍺','🎸','📦','📋','✅',
  '🗺️','🧭','🔑','💼','👗','👟','🩺','💊','📱','🔋',
];

export default function EmojiPicker({ anchor, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const x = Math.min(anchor?.x ?? 0, window.innerWidth - 245);
  const y = Math.min((anchor?.y ?? 0) + 8, window.innerHeight - 220);

  return (
    <div
      ref={ref}
      className="emoji-picker"
      style={{ position: 'fixed', left: x, top: y, zIndex: 300 }}
    >
      {EMOJIS.map(em => (
        <span key={em} className="emoji-opt" onClick={() => onSelect(em)}>{em}</span>
      ))}
    </div>
  );
}
