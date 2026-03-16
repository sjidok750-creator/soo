import { useState, useEffect, useRef } from 'react'

const THRESHOLD = 68
const CORAL = '#E8694A'
const MONO = 'JetBrains Mono, monospace'

/**
 * PullToRefreshWrapper
 * - 어디서 드래그하든 감지: 터치된 요소의 스크롤 컨테이너가 최상단일 때만 발동
 * - 콘텐츠 전체가 아래로 내려갔다가 올라오는 시각 효과
 * - 상단에서 코랄색 인디케이터가 내려옴
 */
export default function PullToRefreshWrapper({ onRefresh, children, bg = '#FAFAFA' }) {
  const wrapperRef  = useRef(null)
  const startY      = useRef(0)
  const active      = useRef(false)

  const [pullY,     setPullY]   = useState(0)
  const [phase,     setPhase]   = useState('idle') // idle | pulling | ready | refreshing

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    /* 터치 좌표 아래에 있는 스크롤 컨테이너를 탐색 */
    function findScrollable(touch) {
      let node = document.elementFromPoint(touch.clientX, touch.clientY)
      while (node && node !== el) {
        const oy = window.getComputedStyle(node).overflowY
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
          return node
        }
        node = node.parentElement
      }
      return null
    }

    function onStart(e) {
      const t = e.touches[0]
      const scrollable = findScrollable(t)
      /* 내부 스크롤 영역이 최상단(scrollTop ≤ 2)이거나 없을 때만 PTR 허용 */
      if (scrollable && scrollable.scrollTop > 2) return
      startY.current = t.clientY
      active.current = true
    }

    function onMove(e) {
      if (!active.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        setPullY(0)
        setPhase('idle')
        return
      }
      /* 고무줄 효과: threshold까지는 1:1, 이후 0.28배 감속 */
      const pull = dy <= THRESHOLD
        ? dy
        : THRESHOLD + (dy - THRESHOLD) * 0.28
      setPullY(Math.min(pull, THRESHOLD * 1.45))
      setPhase(dy >= THRESHOLD ? 'ready' : 'pulling')
    }

    function onEnd(e) {
      if (!active.current) return
      active.current = false
      const dy = e.changedTouches[0].clientY - startY.current
      if (dy >= THRESHOLD) {
        setPhase('refreshing')
        setPullY(THRESHOLD * 0.58)
        onRefresh?.()
        setTimeout(() => {
          setPullY(0)
          setPhase('idle')
        }, 900)
      } else {
        setPullY(0)
        setPhase('idle')
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: true })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
    }
  }, [onRefresh])

  const releasing  = (phase === 'idle' || phase === 'refreshing') && pullY > 0
  const progress   = Math.min(1, pullY / THRESHOLD)
  const isReady    = phase === 'ready' || phase === 'refreshing'
  const showPill   = pullY > 3

  return (
    /* wrapper: 배경색을 페이지와 동일하게 → 당길 때 빈 영역이 자연스럽게 보임 */
    <div ref={wrapperRef} style={{ position: 'relative', background: bg }}>

      {/* 콘텐츠 + 인디케이터를 함께 translateY */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: releasing
            ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'none',
          position: 'relative',
          willChange: 'transform',
        }}
      >
        {/* 인디케이터 — 콘텐츠 위 50px에 위치해서 당길수록 화면에 들어옴 */}
        <div
          style={{
            position: 'absolute',
            top: -52,
            left: 0, right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 999,
            opacity: showPill ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 24,
              background: CORAL,
              color: '#fff',
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: '0.13em',
              boxShadow: `0 4px 16px rgba(232,105,74,0.5)`,
              transform: `scale(${0.72 + progress * 0.28})`,
              transition: 'transform 0.1s',
            }}
          >
            {phase === 'refreshing' ? (
              <svg
                className="animate-spin"
                width="10" height="10" viewBox="0 0 24 24"
                fill="none" stroke="white" strokeWidth="2.5"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg
                width="10" height="10" viewBox="0 0 24 24"
                fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"
                style={{
                  transform: `rotate(${isReady ? 180 : 0}deg)`,
                  transition: 'transform 0.2s',
                }}
              >
                <line x1="12" y1="5" x2="12" y2="19"/>
                <polyline points="5 12 12 19 19 12"/>
              </svg>
            )}
            <span>
              {phase === 'refreshing' ? 'REFRESHING...' : isReady ? 'RELEASE ↑' : '↓ PULL'}
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
