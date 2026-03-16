// 과목 설정
export const SUBJECTS = [
  { id: 'math',    label: '수학',   emoji: '📐', color: 'blue',   bgClass: 'bg-blue-50',   borderClass: 'border-blue-300',   textClass: 'text-blue-700',   badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'english', label: '영어',   emoji: '📖', color: 'emerald', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-300', textClass: 'text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'korean',  label: '국어',   emoji: '📝', color: 'red',    bgClass: 'bg-red-50',    borderClass: 'border-red-300',    textClass: 'text-red-700',    badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'science', label: '과학',   emoji: '🔬', color: 'purple', bgClass: 'bg-purple-50', borderClass: 'border-purple-300', textClass: 'text-purple-700', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'social',  label: '사회',   emoji: '🌏', color: 'amber',  bgClass: 'bg-amber-50',  borderClass: 'border-amber-300',  textClass: 'text-amber-700',  badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'history', label: '역사',   emoji: '🏛️', color: 'orange', bgClass: 'bg-orange-50', borderClass: 'border-orange-300', textClass: 'text-orange-700', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'other',   label: '기타',   emoji: '📚', color: 'gray',   bgClass: 'bg-gray-50',   borderClass: 'border-gray-300',   textClass: 'text-gray-700',   badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' },
]

export const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map(s => [s.id, s]))

export function getSubject(id) {
  return SUBJECT_MAP[id] ?? SUBJECTS[SUBJECTS.length - 1]
}

// ─── +버튼 할일추가 / Task Board 공용 과목 목록 ──────────────────
export const DAILY_SUBJECTS = [
  { id: 'kor',    name: '국어',      abbr: 'KOR',  color: '#E53E3E', bg: '#FEF2F2' },
  { id: 'math',   name: '수학',      abbr: 'MATH', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'eng',    name: '영어',      abbr: 'ENG',  color: '#10B981', bg: '#ECFDF5' },
  { id: 'ss',     name: '사회',      abbr: 'SS',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'kh',     name: '한국사',    abbr: 'KH',   color: '#F97316', bg: '#FFF7ED' },
  { id: 'pl',     name: '정법',      abbr: 'PL',   color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'econ',   name: '경제',      abbr: 'ECON', color: '#14B8A6', bg: '#F0FDFA' },
  { id: 'ei',     name: '윤리와사상', abbr: 'EI',  color: '#6366F1', bg: '#EEF2FF' },
  { id: 'sci',    name: '과학',      abbr: 'SCI',  color: '#06B6D4', bg: '#ECFEFF' },
  { id: 'phy',    name: '물리',      abbr: 'PHY',  color: '#A855F7', bg: '#FAF5FF' },
  { id: 'chem',   name: '화학',      abbr: 'CHEM', color: '#EC4899', bg: '#FDF2F8' },
  { id: 'bio',    name: '생명과학',  abbr: 'BIO',  color: '#84CC16', bg: '#F7FEE7' },
  { id: 'es',     name: '지구과학',  abbr: 'ES',   color: '#0EA5E9', bg: '#F0F9FF' },
  { id: 'custom', name: '직접입력',  abbr: 'ETC',  color: '#94A3B8', bg: '#F9FAFB' },
]

export const DAILY_SUBJECT_MAP = Object.fromEntries(DAILY_SUBJECTS.map(s => [s.id, s]))

export function getDailySubject(id) {
  return DAILY_SUBJECT_MAP[id] ?? DAILY_SUBJECTS[DAILY_SUBJECTS.length - 1]
}

// 학습 유형 (카테고리)
export const STUDY_TYPES = [
  { id: 'preview',  label: '예습',    emoji: '📖', badgeClass: 'bg-sky-100 text-sky-700 border-sky-200' },
  { id: 'review',   label: '복습',    emoji: '🔄', badgeClass: 'bg-teal-100 text-teal-700 border-teal-200' },
  { id: 'homework', label: '숙제',    emoji: '✏️', badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'exam',     label: '시험준비', emoji: '📝', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'other',    label: '기타',    emoji: '📌', badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
]

export const STUDY_TYPE_MAP = Object.fromEntries(STUDY_TYPES.map(t => [t.id, t]))

export function getStudyType(id) {
  return STUDY_TYPE_MAP[id] ?? STUDY_TYPES[STUDY_TYPES.length - 1]
}

// 난이도
export const DIFFICULTIES = [
  { id: 'easy',   label: '쉬움',  stars: '⭐',    badgeClass: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'medium', label: '보통',  stars: '⭐⭐',  badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'hard',   label: '어려움', stars: '⭐⭐⭐', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
]

export const DIFFICULTY_MAP = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]))

export function getDifficulty(id) {
  return DIFFICULTY_MAP[id] ?? DIFFICULTIES[1]
}

// 닉네임별 색상 (동적 생성)
const AVATAR_COLORS = [
  'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-pink-500',
]

export function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
