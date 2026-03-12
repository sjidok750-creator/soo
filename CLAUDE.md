# CLAUDE.md — 스터디버디 (StudyBuddy)

고등학생용 실시간 협업 공부 투두 앱. 닉네임만으로 사용, Firebase 실시간 동기화, PWA 지원.
**TEAM-TODO2(`sjidok750-creator/TEAM-TODO2`)와 완전히 별개 — 절대 수정 금지.**

---

## 기술 스택
React 18 + Vite 6 · Tailwind CSS 3 · Firebase Firestore v10 · GitHub Pages / Actions · JS(JSX, TS 없음)

---

## 파일 구조
```
src/
  main.jsx           # 엔트리 (StrictMode)
  App.jsx            # 루트 (SplashScreen → NicknameGate → SubjectList ↔ SubjectDetail)
  NicknameGate.jsx   # 닉네임 입력 (localStorage: 'study-buddy-nickname')
  SplashScreen.jsx   # 2.6초 스플래시 (splashSpin 애니메이션)
  SubjectList.jsx    # 메인 대시보드 (캘린더·D-day·단어·DailyBoard)
  SubjectDetail.jsx  # 과목별 할일 상세 (드래그앤드롭 정렬)
  Toast.jsx          # 토스트 알림 (useToast 훅)
  firebase.js        # Firebase 초기화 → db export
  subjectConfig.js   # 과목/학습유형/난이도 — 하드코딩 금지, 항상 여기서 참조
  index.css          # Tailwind + keyframe 애니메이션
public/
  manifest.json      # PWA (name: 스터디버디, theme: #0D9488)
  404.html           # SPA 라우팅 폴백 (GitHub Pages)
.github/workflows/deploy.yml  # main push → GitHub Pages 자동 배포
```

---

## App 흐름
```
SplashScreen (2.6s)
  → NicknameGate (닉네임 미입력 시)
    → SubjectList (메인)
      ↔ SubjectDetail (과목 선택 시)
```

---

## Firestore 컬렉션

**`study-todos`** (TEAM-TODO2의 `todos`와 다름)
```js
{
  text, done, author, subject, studyType, difficulty,
  dueDate, order, createdAt,
  // 학습 시간 추적용 (선택)
  date, subjectName, studyStart, studyEnd, totalMinutes
}
```

**`exam-schedule`**
```js
{ title, date, subject, author, createdAt }
```

**`settings`**
```js
// D-day 기기 간 동기화용 (doc ID: 'dday')
{ targetDate, title }
```

보안 규칙: 세 컬렉션 모두 `allow read, write: if true`

---

## 과목 (`subjectConfig.js`)
| ID | 이름 | 이모지 | 색상 |
|----|------|--------|------|
| math | 수학 | 📐 | blue |
| english | 영어 | 📖 | emerald |
| korean | 국어 | 📝 | red |
| science | 과학 | 🔬 | purple |
| social | 사회 | 🌏 | amber |
| history | 역사 | 🏛️ | orange |
| other | 기타 | 📚 | gray |

학습유형: preview(예습) · review(복습) · homework(숙제) · exam(시험준비) · other
난이도: easy(⭐) · medium(⭐⭐) · hard(⭐⭐⭐)

아바타 색상: 닉네임 해시 → 8가지 색상 팔레트 (subjectConfig.js `getNicknameColor`)

---

## 주요 컴포넌트 (SubjectList.jsx)
| 컴포넌트 | 역할 |
|---------|------|
| `CalendarModal` | 시험 일정 관리 (월별 캘린더 + 시험 등록/삭제) |
| `DdayPickerModal` | D-day 설정 2단계: 날짜 선택 → 제목 입력 |
| `DdayCard` | D-day 카운터 표시 (Firestore `settings/dday` 연동) |
| `WordOfDay` | 영어 단어 위젯 (dictionaryapi.dev, localStorage 캐시) |
| `TodoInputSheet` | 하단 시트로 오늘의 할일 추가 |
| `EditTodoModal` | 할일 수정/삭제 (꾹 눌러서 열기) |
| `TodoList` | 오늘의 할일 목록 + 체크박스 + 시간 추적 |
| `StudyTimeGraph` | 과목별 학습 시간 타임라인 시각화 |
| `DailyBoard` | TodoList / StudyTimeGraph 탭 컨테이너 |

---

## 개발
```bash
npm install
# .env.example → .env 에 Firebase 설정 입력
npm run dev
```

빌드: `npm run build` · 배포: `main` push → GitHub Actions 자동 배포

**GitHub Secrets (deploy.yml 환경변수):**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

**Vite 설정:** `base: '/soo/'` (GitHub Pages 경로), React/Firebase 청크 분리

---

## AI 지침

**제약**
- TEAM-TODO2 저장소 수정 금지
- Firebase는 별개 프로젝트 사용

**코딩 규칙**
- Tailwind 유틸리티 패턴 유지
- `subjectConfig.js` 중앙관리 (과목·학습유형·난이도 하드코딩 금지)
- Firebase write → 반드시 `await`
- `onSnapshot` → 언마운트 시 `return unsubscribe`
- `onSnapshot`에 에러 핸들러 추가 (보안 규칙 위반 시 토스트 표시)
- D-day 데이터는 localStorage 아닌 Firestore `settings/dday` 사용 (기기 간 동기화)
- `persistentLocalCache` 사용 금지 (기기 간 데이터 불일치 원인)

**디자인**
- **"그색"/"그색상"** = `#E8694A` (코랄) — 주요 인터랙션·강조에 사용
- 폰트: **JetBrains Mono Regular** (항상 유지, `tailwind.config.js` fontFamily.sans)
- 메인: teal/emerald · 포인트: `#0D9488` · 배경: `from-teal-50 via-emerald-50 to-cyan-50`
- 모바일 우선 (max-w-lg 제약)

**Git 브랜치**: `main`(프로덕션, push 금지) · `feature/` · `fix/` · `claude/`
