import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0)
  // phase 0: all hidden
  // phase 1: "TODO LIST" 등장
  // phase 2: 캐릭터 이미지 등장
  // phase 3: "For. 수현" 등장
  // phase 4: 전체 페이드아웃

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1300),
      setTimeout(() => setPhase(4), 2900),
      setTimeout(onDone, 3600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const mono = "'JetBrains Mono', 'Courier New', monospace"
  const coral = '#E8694A'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        backgroundColor: '#ffffff',
        opacity: phase === 4 ? 0 : 1,
        transition: phase === 4 ? 'opacity 0.7s ease' : 'none',
      }}
    >
      {/* TODO LIST */}
      <h1
        style={{
          fontFamily: mono,
          color: coral,
          fontSize: '2.6rem',
          fontWeight: '700',
          letterSpacing: '0.12em',
          margin: 0,
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(-18px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        TODO LIST
      </h1>

      {/* 캐릭터 이미지 */}
      <div
        style={{
          width: '190px',
          height: '190px',
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#6DDAF0',
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'scale(1)' : 'scale(0.82)',
          transition: 'opacity 0.55s ease, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
          flexShrink: 0,
        }}
      >
        <img
          src="/jamddal.jpg"
          alt="잠뜰 캐릭터"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* For. 수현 */}
      <p
        style={{
          fontFamily: mono,
          color: coral,
          fontSize: '1.9rem',
          fontWeight: '700',
          letterSpacing: '0.06em',
          margin: 0,
          opacity: phase >= 3 ? 1 : 0,
          transform: phase >= 3 ? 'translateY(0)' : 'translateY(14px)',
          transition:
            'opacity 1s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          filter: phase >= 3 ? 'blur(0px)' : 'blur(4px)',
        }}
      >
        For. 수현
      </p>
    </div>
  )
}
