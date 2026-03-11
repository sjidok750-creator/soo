# CLAUDE.md — 스터디버디 (StudyBuddy)

이 파일은 AI 어시스턴트(Claude 등)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 앱 개요

**스터디버디**는 고등학생을 위한 실시간 협업 공부 투두 앱입니다.
- 이름(닉네임)만 입력하면 바로 사용 가능 (로그인 없음)
- Firebase Firestore를 통한 실시간 동기화
- 과목별 할 일 관리 + 시험 일정 캘린더
- PWA 지원 (홈 화면에 추가 가능)

**원본 참조:** TEAM-TODO2 (`github.com/sjidok750-creator/TEAM-TODO2`) 와 동일한 기술 스택으로 만든 별개의 앱입니다. TEAM-TODO2의 Firebase 프로젝트와 완전히 분리되어 있습니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite 6 |
| 스타일링 | Tailwind CSS 3 |
| 데이터베이스 | Firebase Firestore v10 (실시간) |
| 배포 | GitHub Pages |
| CI/CD | GitHub Actions |
| 언어 | JavaScript (JSX, TypeScript 없음) |

---

## 프로젝트 구조

```
soo/
├── public/
│   ├── manifest.json       # PWA 설정
│   ├── 404.html            # GitHub Pages SPA 라우팅
│   └── icon-*.png          # 앱 아이콘 (직접 추가 필요)
├── src/
│   ├── main.jsx            # React 엔트리 포인트
│   ├── App.jsx             # 루트 컴포넌트 (SubjectList ↔ SubjectDetail 전환)
│   ├── NicknameGate.jsx    # 최초 이름 입력 화면
│   ├── SubjectList.jsx     # 메인 화면 (과목 목록 + 전체 통계 + 캘린더)
│   ├── SubjectDetail.jsx   # 과목별 할 일 상세 화면
│   ├── Toast.jsx           # 토스트 알림 컴포넌트
│   ├── firebase.js         # Firebase 초기화
│   ├── subjectConfig.js    # 과목/학습유형/난이도 설정
│   └── index.css           # Tailwind 임포트 + 커스텀 애니메이션
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 자동 배포
├── index.html
├── vite.config.js          # base: '/soo/'
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── .env.example            # Firebase 환경 변수 예시
├── netlify.toml
└── CLAUDE.md               # 이 파일
```

---

## Firestore 데이터 구조

### `study-todos` 컬렉션 (할 일)
```javascript
{
  text: string,           // 할 일 내용 (최대 200자)
  done: boolean,          // 완료 여부
  author: string,         // 작성자 이름
  subject: string,        // 과목 ID (math, english, korean, science, social, history, other)
  studyType: string,      // 학습 유형 (preview, review, homework, exam, other)
  difficulty: string,     // 난이도 (easy, medium, hard)
  dueDate: string | null, // 마감일 (ISO date string, 예: "2026-03-15")
  order: number,          // 드래그 정렬 순서
  createdAt: Timestamp,   // 서버 타임스탬프
}
```

### `exam-schedule` 컬렉션 (시험 일정)
```javascript
{
  title: string,    // 시험명
  date: string,     // 시험 날짜 (ISO date string)
  subject: string,  // 과목 ID
  author: string,   // 등록자
  createdAt: Timestamp,
}
```

### Firestore 보안 규칙 (공개 읽기/쓰기)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /study-todos/{id} {
      allow read, write: if true;
    }
    match /exam-schedule/{id} {
      allow read, write: if true;
    }
  }
}
```

---

## 과목 설정 (`src/subjectConfig.js`)

| ID | 이름 | 이모지 | 색상 |
|----|------|--------|------|
| math | 수학 | 📐 | blue |
| english | 영어 | 📖 | emerald |
| korean | 국어 | 📝 | red |
| science | 과학 | 🔬 | purple |
| social | 사회 | 🌏 | amber |
| history | 역사 | 🏛️ | orange |
| other | 기타 | 📚 | gray |

### 학습 유형

| ID | 이름 | 이모지 |
|----|------|--------|
| preview | 예습 | 📖 |
| review | 복습 | 🔄 |
| homework | 숙제 | ✏️ |
| exam | 시험준비 | 📝 |
| other | 기타 | 📌 |

### 난이도

| ID | 이름 | 표시 |
|----|------|------|
| easy | 쉬움 | ⭐ |
| medium | 보통 | ⭐⭐ |
| hard | 어려움 | ⭐⭐⭐ |

---

## 개발 환경 설정

```bash
# 1. 저장소 클론
git clone https://github.com/sjidok750-creator/soo.git
cd soo

# 2. 의존성 설치
npm install

# 3. Firebase 프로젝트 생성 (https://console.firebase.google.com)
#    - 새 프로젝트 생성 (TEAM-TODO2와 별개)
#    - Firestore Database 활성화
#    - 웹 앱 등록 후 설정값 복사

# 4. 환경 변수 설정
cp .env.example .env
# .env 파일에 Firebase 설정값 입력

# 5. 개발 서버 실행
npm run dev
```

---

## 빌드 및 배포

```bash
npm run build    # dist/ 폴더에 빌드
npm run preview  # 빌드 결과물 미리보기
```

**GitHub Pages 자동 배포:**
1. GitHub 저장소 Settings → Pages → Source: `GitHub Actions`
2. 저장소 Secrets에 Firebase 환경 변수 7개 추가
3. `main` 브랜치에 push하면 자동 배포

**GitHub Secrets 목록:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

---

## AI 어시스턴트를 위한 지침

### 중요 제약사항
- **TEAM-TODO2 저장소(`github.com/sjidok750-creator/TEAM-TODO2`)는 절대 수정하지 않습니다.**
- 이 앱의 Firebase는 TEAM-TODO2와 **완전히 다른 별개의 프로젝트**를 사용합니다.
- 컬렉션명: `study-todos`, `exam-schedule` (TEAM-TODO2의 `todos`와 다름)

### 코딩 규칙
- 기존 Tailwind CSS 유틸리티 클래스 패턴을 유지합니다.
- `subjectConfig.js`의 설정을 중앙에서 관리합니다 (하드코딩 금지).
- 새 기능 추가 시 `subjectConfig.js`를 먼저 확인합니다.
- Firebase write는 반드시 `await`로 처리합니다.
- 실시간 리스너(`onSnapshot`)의 언마운트 시 cleanup(`return unsubscribe`)을 반드시 합니다.

### 색상 테마
- 메인 컬러: teal/emerald (청록/에메랄드)
- 포인트 컬러: `#0D9488` (teal-600)
- 배경: `from-teal-50 via-emerald-50 to-cyan-50`

### Git 브랜치 전략
- `main` — 프로덕션 (직접 push 금지)
- `feature/<기능명>` — 기능 개발
- `fix/<버그명>` — 버그 수정
- `claude/<작업명>` — AI 어시스턴트 작업

---

*이 앱은 TEAM-TODO2(`sjidok750-creator/TEAM-TODO2`)를 참고하여 만든 독립적인 프로젝트입니다.*
