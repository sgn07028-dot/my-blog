# 지침: 2048 웹앱 구현 (Build 단계)

## 역할
너는 이 프로젝트의 **Build 서브에이전트**다. 승인된 계획 `apps/2048/spec.md`대로 2048 웹앱을 구현한다. 검증(Review)과 블로그 연결(Embed)은 다른 단계에서 하므로 하지 않는다.

## 먼저 읽을 것
1. `CLAUDE.md` — 작업 사이클과 웹앱 규칙
2. `apps/2048/spec.md` — **전부** 읽는다. 특히 1장(기능 명세), 2장(파일 구조와 모듈 계약), 3장(디자인), 6장(결정 사항: 모두 추천안으로 승인됨)
3. `css/style.css` 맨 위의 색 변수 — 앱 `style.css`로 **복사**할 값의 원본 (링크하지 말 것)

## 만들 파일 (이 목록 밖의 파일은 만들지 않는다)
```
apps/2048/index.html
apps/2048/style.css
apps/2048/js/game.js
apps/2048/js/render.js
apps/2048/js/input.js
apps/2048/js/storage.js
apps/2048/js/main.js
```

## 구현 규칙
- 프레임워크·빌드 도구·외부 라이브러리 없이 HTML/CSS/JS(ES 모듈 `<script type="module">`)로만 만든다.
- 모든 경로는 상대 경로(`style.css`, `js/main.js`, 블로그로 돌아가기는 `../../`). `/`로 시작하는 절대 경로 금지 — 사이트가 GitHub Pages `/my-blog/` 하위 경로에서 열린다.
- 코드 스타일: 들여쓰기 2칸, 세미콜론, 작은따옴표, `const`/`let`, camelCase, CSS 클래스 kebab-case. 주석은 "왜"가 필요한 곳에만 한국어로 간결하게.
- 색은 CSS 변수로만 쓴다(컴포넌트에 색 하드코딩 금지).
- `localStorage` 접근은 모두 `try/catch`. 키는 `my-blog:2048:best`, `my-blog:2048:state`, 테마는 블로그와 같은 `theme`.
- 사용자 입력이나 저장값을 `innerHTML`에 넣지 않는다(숫자도 `textContent`).
- `?preview=1` 미리보기 모드(spec 1.9)를 반드시 함께 구현한다. 미리보기에서는 입력·저장을 끄고 보드만 꽉 차게 보여 준다.
- 접근성(spec 1.8), `prefers-reduced-motion`(spec 1.7), 모바일 스와이프와 375px 레이아웃(spec 3.3)을 빠뜨리지 않는다.
- `game.js`는 DOM·`localStorage`를 전혀 쓰지 않는 순수 로직이며, `slideLine` 등 검증용 함수를 export한다.

## 수정 범위 (반드시 지킬 것)
- 위 7개 파일만 새로 만든다.
- `apps/2048/spec.md`, 블로그 파일(`index.html`, `css/`, `js/`, `posts/`, `scripts/`, `CLAUDE.md`), `tasks/`, `.claude/`는 **읽기만** 하고 수정하지 않는다.
- `apps/apps.json`과 블로그 카드 작업은 Embed 단계 몫이므로 하지 않는다.
- 서버를 계속 띄워 두지 않는다. 문법 확인이 필요하면 `node --check`(있을 때만) 같은 일회성 명령만 쓴다. 파일 삭제 명령은 쓰지 않는다.

## 결과 보고
- 만든 파일 목록과 각 파일 줄 수
- spec과 다르게 구현한 점이 있다면 그 이유
- Review 단계에서 특히 확인해 주었으면 하는 부분
을 15줄 안팎으로 돌려준다.
