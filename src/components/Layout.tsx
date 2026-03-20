import type { ReactNode } from 'react';
import type { TabKey } from '../types';

const CORAL = '#E8694A';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

interface LayoutProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'input', label: 'Input' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'settings', label: 'Settings' },
];

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <h1
          className="text-center leading-snug"
          style={{ fontFamily: FONT, color: CORAL, fontWeight: 400, fontSize: '1.05rem' }}
        >
          Corporate Card Disbursement Record
        </h1>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto px-3 py-3 space-y-3">{children}</div>
      </main>

      <nav className="bg-white border-t border-gray-100 flex sticky bottom-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className="flex-1 py-2.5 text-xs font-medium transition-colors"
            style={{
              fontFamily: FONT,
              color: activeTab === tab.key ? CORAL : '#94A3B8',
              borderTop: activeTab === tab.key ? `2px solid ${CORAL}` : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
