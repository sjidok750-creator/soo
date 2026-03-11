import { useState, useEffect } from 'react'

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, onRemove])

  return (
    <div className="flex items-center gap-2.5 bg-gray-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg max-w-xs w-full animate-slide-up">
      <span className="text-base shrink-0">{toast.icon ?? '🔔'}</span>
      <p className="leading-snug break-words flex-1">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => { toast.action.fn(); onRemove(toast.id) }}
          className="shrink-0 text-teal-300 hover:text-teal-100 font-bold text-xs border border-teal-400 rounded px-2 py-0.5 ml-1"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState([])

  function addToast(message, { icon, duration, action } = {}) {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, icon, duration, action }])
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function ToastContainer() {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    )
  }

  return { addToast, ToastContainer }
}
