# CLAUDE.md — 스터디버디 (StudyBuddy)

고등학생용 실시간 협업 공부 투두 앱. 닉네임만으로 사용, Firebase 실시간 동기화, PWA 지원.
**TEAM-TODO2(`sjidok750-creator/TEAM-TODO2`)와 완전히 별개 — 절대 수정 금지.**

---

## 기술 스택
React 18 + Vite 6 · Tailwind CSS 3 · Firebase Firestore v10 · GitHub Pages / Actions · JS(JSX, TS 없음)

## 파일 구조
```
src/
  main.jsx          # 엔트리
  App.jsx           # 루트 (SubjectList ↔ SubjectDetail 전환)
  NicknameGate.jsx  # 닉네임 입력
  SubjectList.jsx   # 메인 (과목목록+통계+캘린더)
  SubjectDetail.jsx # 과목별 할일 상세
  Toast.jsx
  firebase.js
  subjectConfig.js  # 과목/학습유형/난이도 — 하드코딩 금지, 항상 여기서 참조
  index.css
```

---

## Firestore 컬렉션

**`study-todos`** (TEAM-TODO2의 `todos`와 다름)
```js
{ text, done, author, subject, studyType, difficulty, dueDate, order, createdAt }
```
**`exam-schedule`**
```js
{ title, date, subject, author, createdAt }
```
보안 규칙: 두 컬렉션 모두 `allow read, write: if true`

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

---

## 개발
```bash
npm install && npm run dev
# .env.example → .env 에 Firebase 설정 입력
```
빌드: `npm run build` · 배포: main push → GitHub Actions 자동 배포
GitHub Secrets: `VITE_FIREBASE_API_KEY` `AUTH_DOMAIN` `PROJECT_ID` `STORAGE_BUCKET` `MESSAGING_SENDER_ID` `APP_ID` `MEASUREMENT_ID`

---

## AI 지침

**제약**
- TEAM-TODO2 저장소 수정 금지
- Firebase는 별개 프로젝트 사용

**코딩 규칙**
- Tailwind 유틸리티 패턴 유지
- `subjectConfig.js` 중앙관리 (하드코딩 금지)
- Firebase write → 반드시 `await`
- `onSnapshot` → 언마운트 시 `return unsubscribe`

**디자인**
- **"그색"/"그색상"** = `#E8694A` (코랄)
- 폰트: **JetBrains Mono Regular** (항상 유지, `tailwind.config.js` fontFamily.sans)
- 메인: teal/emerald · 포인트: `#0D9488` · 배경: `from-teal-50 via-emerald-50 to-cyan-50`

**Git 브랜치**: `main`(프로덕션, push 금지) · `feature/` · `fix/` · `claude/`
