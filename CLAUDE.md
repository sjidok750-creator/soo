# CLAUDE.md — 스터디버디 (StudyBuddy)

고등학생용 실시간 협업 공부 투두 앱. 닉네임만으로 사용, Firebase 실시간 동기화, PWA 지원.
**TEAM-TODO2(`sjidok750-creator/TEAM-TODO2`)와 완전히 별개 — 절대 수정 금지.**

---

## 기술 스택

React 18 + Vite 6 · Tailwind CSS 3 · Firebase Firestore v10 · GitHub Pages / Actions · JS(JSX, TS 없음)

---

## 파일 구조

```
/
├── .github/workflows/deploy.yml   # GitHub Pages 자동 배포
├── public/
│   ├── 404.html                   # GitHub Pages SPA 라우팅
│   ├── icon.svg
│   ├── jamddal.jpg
│   └── manifest.json              # PWA manifest
├── src/
│   ├── main.jsx                   # 엔트리
│   ├── App.jsx                    # 루트 (SplashScreen → NicknameGate → SubjectList ↔ SubjectDetail)
│   ├── SplashScreen.jsx           # 2.6초 로딩 스플래시 (#E8694A 코랄 애니메이션)
│   ├── NicknameGate.jsx           # 닉네임 입력 (localStorage: study-buddy-nickname)
│   ├── SubjectList.jsx            # 메인 대시보드 (일일투두+캘린더+통계+D-day)
│   ├── SubjectDetail.jsx          # 과목별 할일 상세 (CRUD+드래그정렬)
│   ├── Toast.jsx                  # 토스트 알림 훅/컴포넌트
│   ├── firebase.js                # Firebase 초기화, db export
│   ├── subjectConfig.js           # 과목/학습유형/난이도 — 하드코딩 금지, 항상 여기서 참조
│   └── index.css                  # Tailwind + 커스텀 애니메이션
├── .env.example
├── firebase.json
├── firestore.rules
├── index.html                     # PWA 메타, 폰트, SPA 리다이렉트 스크립트
├── netlify.toml                   # Netlify 대안 배포 설정
├── package.json
├── tailwind.config.js
└── vite.config.js                 # base: /soo/, 코드 스플리팅 (vendor-react, vendor-firebase)
```

---

## Firestore 컬렉션

**`study-todos`** — SubjectDetail 할일 (TEAM-TODO2의 `todos`와 다름)
```js
{ text, done, author, subject, studyType, difficulty, dueDate, order, createdAt }
```

**`study-todos`** — SubjectList 일일 투두 (같은 컬렉션, 필드 구조 다름)
```js
{ text, subject, subjectName, studyStart, studyEnd, totalMinutes, date, author, done, createdAt, order }
```

**`exam-schedule`** — 시험/이벤트 일정
```js
{ title, date, subject, author, createdAt }
```

**`settings`** — 앱 설정 (향후 확장용)

보안 규칙: 세 컬렉션 모두 `allow read, write: if true`

---

## 컴포넌트 상세

### App.jsx
- `splashDone` (2.6s): 스플래시 완료 여부
- `currentSubject`: 선택된 과목 → SubjectDetail 전환

### SplashScreen.jsx
- SVG 기반 "TODO LIST" 디자인, `#E8694A` 코랄 색상
- `splashSpin` 커스텀 애니메이션 (index.css에 정의)

### NicknameGate.jsx
- 1~20자 유효성 검사
- `localStorage` 키: `study-buddy-nickname`

### SubjectDetail.jsx (약 519줄)
주요 기능:
- `onSnapshot` 실시간 동기화
- 할일 CRUD (추가/수정/삭제/완료토글)
- 드래그앤드롭 정렬 (마우스 + 터치 지원)
- 필터: 전체/진행중/완료
- 진행도 프로그레스바
- 메타데이터: 학습유형, 난이도, 마감일, 작성자
- D-Day 계산 (`D-Day`, `D-N`, `D+N`)

### SubjectList.jsx (약 1147줄)
주요 내부 컴포넌트:
- `CalendarModal`: 월간 시험 일정 캘린더 (추가/삭제)
- `DdayPickerModal`: 2단계 날짜+제목 D-day 선택
- `WordOfDay`: 영단어 (Dictionary API, localStorage 캐시)
- `DdayCard`: D-day 카드 표시
- `TodoInputSheet`: 일일 할일 추가 (과목+시간 추적)
- `EditTodoModal`: 투두 수정 (텍스트/과목/학습시간)
- `TodoList`: 일일 투두 목록 (길게누르기 편집)
- `StudyTimeGraph`: 학습 시간대 시각화 (다크테마, 과목별 색상)
- `DailyBoard`: 일일 투두 컨테이너

주요 데이터:
- `DAILY_SUBJECTS`: 14개 상세 과목 설정 (국어/수학/영어/사회/역사/물리/화학/생물/지구과학/경제/윤리/법/과학/사용자정의)
- `DAILY_WORDS`: 65개 영단어 목록
- `FIXED_HOLIDAYS`: 8개 한국 공휴일

### Toast.jsx
- `useToast()` 훅 → `addToast`, `removeToast`
- 자동 제거 (기본 4초, 커스텀 가능)
- 선택적 액션 버튼

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

학습유형: `preview`(예습) · `review`(복습) · `homework`(숙제) · `exam`(시험준비) · `other`
난이도: `easy`(⭐) · `medium`(⭐⭐) · `hard`(⭐⭐⭐)
아바타: `getAvatarColor(nickname)` — 해시 기반 색상 자동 할당

---

## 개발

```bash
# 의존성 설치
npm install

# .env.example → .env 복사 후 Firebase 설정 입력
cp .env.example .env

# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

### 환경 변수 (`.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### GitHub Secrets (CI/CD)
`VITE_FIREBASE_API_KEY` · `AUTH_DOMAIN` · `PROJECT_ID` · `STORAGE_BUCKET` · `MESSAGING_SENDER_ID` · `APP_ID` · `MEASUREMENT_ID`

### 배포
- **GitHub Pages**: `main` push → `.github/workflows/deploy.yml` 자동 실행 (Node 20, `npm ci`, artifact upload)
- **Netlify**: `netlify.toml` 설정 포함 (대안 배포)
- **Base URL**: `/soo/` (vite.config.js `base` 설정)

---

## AI 지침

### 제약
- TEAM-TODO2 저장소 수정 금지
- Firebase는 별개 프로젝트 사용 (환경 변수로 분리)

### 코딩 규칙
- Tailwind 유틸리티 패턴 유지 (인라인 스타일 지양)
- `subjectConfig.js` 중앙관리 — 과목/학습유형/난이도 하드코딩 금지
- Firebase write → 반드시 `await`
- `onSnapshot` → 언마운트 시 반드시 `return unsubscribe` (메모리 누수 방지)
- Firebase v10 모듈형 임포트 사용 (`import { doc, ... } from 'firebase/firestore'`)
- TypeScript 없음 — 순수 JS/JSX 유지

### 디자인 시스템
- **"그색"/"그색상"** = `#E8694A` (코랄) — 스플래시, 포인트 요소
- **폰트**: JetBrains Mono Regular (항상 유지, `tailwind.config.js` `fontFamily.sans`)
- **배경 그라디언트**: `from-teal-50 via-emerald-50 to-cyan-50`
- **메인 포인트**: `#0D9488` (teal-600)
- **테마 색상**: teal/emerald 계열

### Git 브랜치
- `main`: 프로덕션 (직접 push 금지)
- `feature/기능명`: 새 기능
- `fix/버그명`: 버그 수정
- `claude/작업명`: AI 작업 브랜치
