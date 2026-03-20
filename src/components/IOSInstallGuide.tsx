import { useEffect, useState } from 'react';

export function IOSInstallGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('ios-guide-dismissed');
    if (isIOS && !isStandalone && !dismissed) {
      setTimeout(() => setShow(true), 3000);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem('ios-guide-dismissed', '1');
    setShow(false);
  };

  return (
    <div className="fixed bottom-16 inset-x-3 bg-white rounded-xl shadow-lg p-4 border border-gray-100 z-50">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E8694A' }}>
          Add to Home Screen
        </p>
        <button onClick={dismiss} className="text-gray-400 text-xs">✕</button>
      </div>
      <p className="text-xs text-gray-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        Tap Share → "Add to Home Screen" for app experience
      </p>
    </div>
  );
}
