import { useState } from 'react'

export default function NicknameGate({ onEnter }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError('이름을 입력해주세요.')
      return
    }
    if (trimmed.length > 20) {
      setError('이름은 20자 이내로 입력해주세요.')
      return
    }
    onEnter(trimmed)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">📚</div>
          <h1 className="text-2xl font-bold text-gray-800">스터디버디</h1>
          <p className="text-sm text-gray-500 mt-1">함께 공부하고 목표를 달성하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 (닉네임)
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError('')
              }}
              placeholder="사용할 이름을 입력하세요"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              autoFocus
              maxLength={20}
            />
            {error && (
              <p className="text-red-500 text-xs mt-1">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-lg transition active:scale-95"
          >
            공부 시작하기 🚀
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          입력한 이름은 할 일 작성 시 표시됩니다
        </p>
      </div>
    </div>
  )
}
