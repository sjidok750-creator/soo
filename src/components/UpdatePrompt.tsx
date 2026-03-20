import { useEffect, useState } from 'react';

export function UpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('swUpdated', handler);
    return () => window.removeEventListener('swUpdated', handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 border border-gray-100 z-50">
      <span className="text-xs text-gray-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        New version available
      </span>
      <button
        onClick={() => window.location.reload()}
        className="text-xs font-medium px-3 py-1 rounded-lg text-white"
        style={{ backgroundColor: '#E8694A', fontFamily: "'JetBrains Mono', monospace" }}
      >
        Update
      </button>
    </div>
  );
}
