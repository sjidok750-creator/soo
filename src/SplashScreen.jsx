import { useEffect } from 'react'

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#fff7f5' }}>
      <div style={{ animation: 'splashSpin 2.4s ease forwards' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="200" height="200">
          <rect x="148" y="220" width="728" height="584" rx="20" ry="20"
                fill="#fff7f5" stroke="#E8694A" strokeWidth="32"/>
          <rect x="178" y="250" width="668" height="524" rx="8" ry="8"
                fill="none" stroke="#E8694A" strokeWidth="8" opacity="0.3"/>
          <text x="512" y="462"
                fontFamily="'JetBrains Mono', 'Courier New', monospace"
                fontSize="210"
                fontWeight="700"
                fill="#E8694A"
                textAnchor="middle"
                dominantBaseline="middle"
                letterSpacing="18">TODO</text>
          <line x1="208" y1="512" x2="816" y2="512"
                stroke="#E8694A" strokeWidth="14" strokeLinecap="round" opacity="0.55"/>
          <text x="512" y="562"
                fontFamily="'JetBrains Mono', 'Courier New', monospace"
                fontSize="210"
                fontWeight="700"
                fill="#E8694A"
                textAnchor="middle"
                dominantBaseline="middle"
                letterSpacing="18">LIST</text>
        </svg>
      </div>
    </div>
  )
}
