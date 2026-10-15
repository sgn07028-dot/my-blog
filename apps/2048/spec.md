# 2048 웹앱 계획 (spec)

> 사용자 요청: "2048 게임을 만들어줘. 방향키로 숫자 타일을 밀어서 합치는 퍼즐 게임이야. 점수판도 넣어줘"
>
> 이 문서는 Plan 단계 산출물입니다. **사용자 승인 전에는 구현을 시작하지 않습니다.**
> 맨 아래 "사용자에게 확인받을 결정 사항"을 먼저 확인해 주세요.

---

## 0. 전제와 제약

- 순수 HTML / CSS / JavaScript(ES 모듈, `<script type="module">`)만 사용합니다. 외부 라이브러리·CDN 없음, 빌드 없음, `package.json` 없음.
- 앱은 `apps/2048/` 폴더 안에서 **자체 완결**됩니다. 블로그의 `css/style.css`를 링크하지 않고, 필요한 색 값은 앱 CSS에 복사합니다.
- GitHub Pages 하위 경로(`https://sgn07028-dot.github.io/my-blog/apps/2048/`)에서 열리므로 모든 경로는 `/`로 시작하지 않는 **상대 경로**로 씁니다. (예: `style.css`, `js/game.js`, 블로그로 돌아가기는 `../../`)
- Build 단계는 `apps/2048/` 밖의 파일을 건드리지 않습니다. 블로그 파일 수정은 Embed 단계에서만 합니다.
- 로컬 확인: 저장소 루트에서 `python -m http.server 8000` 실행 후 `http://localhost:8000/apps/2048/` 접속(ES 모듈이라 `file://`로는 동작하지 않음).
- 코드 스타일은 블로그와 같게: 들여쓰기 2칸, 세미콜론, 작은따옴표, `const`/`let`, camelCase 함수·변수, kebab-case CSS 클래스, 주석은 "왜"가 필요한 곳에만 한국어로.

---

## 1. 기능 명세

### 1.1 보드와 타일 생성

- 4×4 보드. 내부 표현은 `null | Tile` 16칸(또는 4×4 2차원 배열).
- `Tile = { id, value, row, col, mergedFrom?: [idA, idB], isNew?: boolean }`
  - `id`는 증가하는 정수. 화면에서 같은 타일 요소를 재사용해 이동 애니메이션을 하기 위해 필요합니다.
- **새 게임 시작**: 빈 보드의 무작위 빈칸 2곳에 타일 2개를 생성합니다.
- **새 타일 생성 규칙**: 보드가 실제로 바뀐 이동 뒤에만 1개 생성.
  - 위치: 남은 빈칸 중 균등 무작위.
  - 값: 90% 확률로 `2`, 10% 확률로 `4`.
- 무작위 함수(`rng`)는 인자로 주입받아(기본값 `Math.random`) 테스트·미리보기에서 결정적으로 만들 수 있게 합니다.

### 1.2 이동·합치기 규칙 (정확한 정의)

방향(`up | down | left | right`)마다 각 줄(행 또는 열)을 **이동 방향 쪽 끝부터** 읽어 아래 순서로 처리합니다.

1. 빈칸을 제외한 타일만 순서대로 모읍니다. (예: 왼쪽 이동, `[2, _, 2, 4]` → `[2, 2, 4]`)
2. 앞에서부터 보며 **바로 다음 타일과 값이 같으면 하나로 합칩니다**(값 2배). 합친 결과 타일은 **이번 이동에서 다시 합쳐지지 않습니다.** 합쳐지지 않은 타일은 그대로 둡니다.
3. 결과를 이동 방향 끝부터 채우고 나머지는 빈칸.

예시(왼쪽 이동):

| 이동 전 | 이동 후 | 얻는 점수 | 설명 |
| --- | --- | --- | --- |
| `2 2 2 2` | `4 4 _ _` | 8 | 두 쌍이 각각 합쳐짐 |
| `2 2 4 _` | `4 4 _ _` | 4 | 새로 생긴 4는 기존 4와 다시 합쳐지지 않음 |
| `4 2 2 _` | `4 4 _ _` | 4 | 같은 이유 |
| `2 2 2 _` | `4 2 _ _` | 4 | 이동 방향 쪽(왼쪽) 쌍이 먼저 합쳐짐 |
| `2 _ _ 2` | `4 _ _ _` | 4 | 사이 빈칸은 무시 |
| `4 4 8 8` | `8 16 _ _` | 24 | |
| `2 4 8 16` | 변화 없음 | 0 | 유효하지 않은 이동 |

- 오른쪽/아래 이동은 줄을 뒤집어 같은 규칙을 적용한 뒤 다시 뒤집는 방식으로 구현합니다(규칙 코드 하나로 4방향 처리).
- **점수**: 합쳐질 때마다 합쳐진 결과 값을 현재 점수에 더합니다.
- **유효하지 않은 이동**(어떤 타일도 움직이거나 합쳐지지 않음): 보드·점수 변화 없음, 새 타일 생성 없음, 애니메이션 없음.

### 1.3 점수판

- **현재 점수(SCORE)**: 이동으로 얻은 점수의 합. 점수가 오를 때 `+8` 같은 증가량을 잠깐 띄웁니다(감소 동작 시 생략).
- **최고 점수(BEST)**: 현재 점수가 최고 점수를 넘으면 즉시 갱신하고 `localStorage`에 저장.
  - 키: `my-blog:2048:best` (GitHub Pages에서는 `sgn07028-dot.github.io` 출처를 사용자의 다른 저장소와 공유하므로 접두어로 충돌을 피합니다.)
  - 모든 `localStorage` 접근은 `try/catch`로 감싸, 실패해도 게임은 정상 동작(최고 점수만 이번 방문 동안 유지).
- **새 게임 버튼**: 현재 판을 버리고 새로 시작. 진행 중인 판(점수 > 0이고 게임 오버가 아님)이면 실수 방지를 위해 확인(`confirm` 대신 앱 내부 작은 확인 대화상자 또는 버튼 두 번 누르기 — 결정 사항 참고) 후 시작.

### 1.4 승리 / 게임 오버

- **승리**: 이동 결과 처음으로 `2048` 타일이 생기면 승리 안내 오버레이를 띄웁니다.
  - 버튼: `계속하기`(오버레이 닫고 같은 판 진행), `새 게임`.
  - 한 판에서 승리 안내는 **한 번만** 띄웁니다(`state.won`, `state.keepPlaying` 플래그). 계속하기 후 4096 등을 만들어도 다시 띄우지 않습니다.
- **게임 오버**: 새 타일을 놓은 뒤 ① 빈칸이 없고 ② 가로·세로로 인접한 같은 값이 하나도 없으면 게임 오버.
  - 오버레이: "더 이상 움직일 수 없습니다", 최종 점수, 최고 점수 갱신 여부, `다시 하기` 버튼.
- 오버레이가 떠 있는 동안 이동 입력은 무시합니다.

### 1.5 진행 상태 저장 (추천, 결정 사항 참고)

- 이동마다 보드·점수·`won/keepPlaying` 플래그를 `localStorage`의 `my-blog:2048:state`에 저장하고, 다시 열면 이어서 합니다. 저장값이 깨져 있으면(파싱 실패, 형식 불일치) 무시하고 새 게임.
- 게임 오버가 되면 저장 상태를 지웁니다.

### 1.6 입력

- **키보드**: 방향키(`ArrowUp/Down/Left/Right`)와 `W/A/S/D`(대소문자 무관, `event.key` 기준이며 한글 자판 상태 대비 `event.code`의 `KeyW/KeyA/KeyS/KeyD`도 함께 인식).
  - `document`에 `keydown` 리스너. `Ctrl/Alt/Meta`가 눌린 조합은 무시(브라우저 단축키 보호).
  - 게임 키로 처리한 경우에만 `preventDefault()`(방향키로 페이지가 스크롤되지 않게).
  - 오버레이가 열려 있으면 이동 키를 무시하고, `Esc`는 승리 오버레이에서 "계속하기"와 같게 동작.
- **모바일 스와이프**: 보드 요소에 Pointer Events(`pointerdown` / `pointerup`, `pointercancel` 처리).
  - 이동 거리가 30px 이상이고, 가로·세로 중 더 큰 축 방향으로 판정. 그보다 짧으면 무시.
  - 보드에 `touch-action: none`을 줘 스와이프가 페이지 스크롤·당겨서 새로고침으로 새지 않게 합니다(보드 밖은 일반 스크롤 가능).
  - 마우스 드래그로도 같은 방식으로 동작(데스크톱 테스트에 유용).
- 연속 입력: 애니메이션이 끝날 때까지 기다리지 않고 입력 즉시 상태를 갱신하고 다시 그립니다(이전 애니메이션은 새 위치로 이어서 전환). 입력 큐는 두지 않습니다.

### 1.7 애니메이션과 `prefers-reduced-motion`

- **이동**: 타일 요소를 `transform: translate(...)`로 배치하고 `transition: transform 120ms ease-out`.
- **합치기**: 이동이 끝난 뒤 결과 타일에 짧은 "팝"(scale 1 → 1.12 → 1, 150ms) 키프레임.
- **생성**: 새 타일은 scale 0 → 1 페이드인(150ms, 이동 시간만큼 지연).
- 합쳐지는 두 원본 타일은 결과 칸까지 이동한 뒤 제거하고, 그 자리에 결과 타일을 표시합니다(`mergedFrom` 이용).
- `@media (prefers-reduced-motion: reduce)`: 모든 transition·animation을 제거해 즉시 배치합니다. JS에서도 `matchMedia`로 확인해 애니메이션 종료 대기(`setTimeout`) 시간을 0으로 합니다.

### 1.8 접근성

- 시맨틱 구조: `header`(제목·점수판·버튼), `main`(보드), `footer`(조작 안내·블로그로 돌아가기 링크).
- 키보드만으로 전부 가능: 이동(방향키/WASD), 새 게임(버튼 포커스 후 Enter/Space), 오버레이 버튼.
- 보드 컨테이너: `role="group"` + `aria-label="2048 게임판"` + `aria-describedby`로 조작 안내 문장 연결. 개별 타일 요소는 시각용이라 `aria-hidden="true"`.
- **스크린리더 알림**: 화면에 보이지 않는(visually-hidden) `aria-live="polite"` 영역 하나를 둡니다.
  - 이동마다: "왼쪽으로 이동. 16 만듦, +16점. 점수 120." 처럼 짧게. 유효하지 않은 이동이면 "움직일 수 없는 방향입니다."
  - 점수 숫자 요소 자체는 `aria-live`로 두지 않습니다(알림이 중복되지 않게).
- **오버레이(승리/게임 오버)**: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. 열릴 때 첫 버튼으로 포커스 이동, 닫히면 보드로 포커스 복귀. 열린 동안 Tab이 오버레이 안에서만 돌게(포커스 트랩) 합니다. `<dialog>` 요소의 `showModal()`을 써도 됩니다(최신 브라우저 지원).
- `:focus-visible` 외곽선을 없애지 않습니다.
- 버튼 터치 영역 최소 44×44px.
- (선택) 보드 상태 전체를 읽어 주는 숨은 표: 이번 범위에서는 제외하고, 필요하면 후속 개선으로.

### 1.9 미리보기 모드 (Embed용)

- URL에 `?preview=1`이 있으면:
  - 고정 시드의 데모 보드(예: 2·4·8·…·512가 섞인 보기 좋은 배치)를 그립니다.
  - 키보드·스와이프 입력과 `localStorage` 쓰기를 모두 끕니다(블로그 메인에서 최고 점수·진행 상태를 덮어쓰지 않게).
  - 헤더·푸터 대신 보드(와 작은 점수판)만 꽉 차게 보여 줍니다(`html.is-preview` 클래스로 CSS 분기).
- 이 기능은 Build 단계에서 함께 구현합니다(Embed 단계에서는 앱 파일을 다시 열지 않기 위해).

---

## 2. 파일 구조

```
apps/2048/
├── index.html      # 진입점. head의 짧은 인라인 스크립트로 테마 결정(FOUC 방지), 마크업 골격
├── style.css       # 앱 전체 스타일. 블로그 색 변수를 복사한 :root / [data-theme="light"] 정의
├── js/
│   ├── game.js     # 순수 게임 로직 (DOM·localStorage 접근 금지)
│   ├── render.js   # 상태 → DOM 그리기, 애니메이션 클래스, 오버레이, 점수 표시, live 알림 문구
│   ├── input.js    # 키보드·스와이프 → 방향 문자열 콜백 (게임 규칙 모름)
│   ├── storage.js  # localStorage 래퍼(try/catch), 최고 점수·진행 상태 읽기/쓰기/검증
│   └── main.js     # 시작점. 상태 보관, 입력 → game → render → storage 연결, 미리보기 모드 분기
└── spec.md         # 이 문서
```

- (Review 단계에서 `apps/2048/review.md`가 추가됩니다.)
- 미리보기를 정적 이미지로 하기로 결정하면 `apps/2048/preview.svg`(또는 `.png`)를 추가합니다.

### 모듈 계약

**`game.js`** (순수 함수, 입력 상태를 변경하지 않고 새 상태를 반환)

```text
createGame({ rng = Math.random } = {}) → state
  state = { board: (Tile|null)[16], score, won, keepPlaying, over, nextId }
move(state, direction, { rng }) → { state, moved, scoreGained, mergedValues: number[], spawned: Tile|null }
canMove(state) → boolean
hasWon(state) → boolean          // 2048 이상 타일 존재
continueGame(state) → state      // keepPlaying = true
serialize(state) / deserialize(obj) → 저장용 단순 객체 ↔ state (deserialize는 형식 검증 후 실패 시 null)
```

- 브라우저 콘솔이나 별도 HTML 없이도 위 표(1.2)의 예시를 검증할 수 있도록, 줄 하나를 처리하는 `slideLine(values) → { values, gained }` 같은 내부 함수를 `export`해 둡니다(Review 단계에서 콘솔로 확인용).

**`render.js`**

```text
createRenderer(rootElements, { reducedMotion }) → { render(state, moveResult?), showOverlay(type, info), hideOverlay(), announce(text) }
```
- 타일 요소는 `Map<id, HTMLElement>`로 관리해 재사용(이동 애니메이션). 사라진 id는 이동 완료 후 제거.
- 타일 숫자는 `textContent`로만 넣습니다(`innerHTML` 사용 안 함).

**`input.js`**

```text
bindInput({ board, onMove(direction), isBlocked() }) → unbind()
```

**`storage.js`**

```text
loadBest() → number, saveBest(n), loadState() → object|null, saveState(obj), clearState()
```

---

## 3. 디자인

### 3.1 색과 테마

- `style.css` 맨 위에 블로그 `css/style.css`의 변수를 **복사**합니다: `--color-bg #050507`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`(시안 `#00f0ff`), `--color-link`(핑크 `#ff4fd8`), `--color-highlight`(그린 `#39ff14`), `--color-tag`(옐로 `#f5ff3b`), `--glow-*`, 폰트 스택 등. 라이트 값은 `:root[data-theme="light"]`에 동일하게 복사(글로우는 `none`).
- 컴포넌트에서는 변수만 사용(하드코딩 금지). 타일 색도 변수로 정의합니다.
- **테마 결정**: `index.html` `<head>`의 인라인 스크립트가 `localStorage.getItem('theme')`(블로그와 같은 키)를 읽어 `<html data-theme>`를 정합니다. 기본은 `dark`.
- 블로그에서 테마를 바꾸면 `storage` 이벤트로 앱(미리보기 iframe 포함)도 즉시 따라가게 합니다.
- 앱 자체 테마 토글 버튼 제공 여부는 결정 사항 참고(추천: 제공, 같은 `theme` 키에 저장 → 블로그와 동기화).

### 3.2 화면 구성

```
> ./2048                          [← cd ../..]
2048                     SCORE 1204  BEST 5320
// 같은 숫자를 합쳐 2048을 만드세요   [ new_game ]
┌───────────────────────────────┐
│  2 │    │  8 │    │
│    │ 16 │    │  4 │   ← 보드 (네온 테두리 + 옅은 글로우)
│ ...                            │
└───────────────────────────────┘
방향키 / WASD / 스와이프로 이동
```

- 제목 "2048"은 시안 + `--glow-accent`, 프롬프트(`> ./2048`)·점수 라벨·버튼 글자는 고정폭 폰트(그린/핑크), 숫자 타일은 고정폭 굵은 글꼴.
- 점수 상자: 테두리 `--color-border`, 값은 `--color-tag`(옐로) 강조. 점수 증가 `+N`은 위로 떠오르며 사라지는 짧은 애니메이션(reduced-motion이면 생략).
- 보드 배경: `--color-surface`, 빈칸: `--color-surface-2`, 보드 테두리: `--glow-box`.
- **타일 단계별 색** (다크 기준, 글자 대비 4.5:1 이상 유지):

| 값 | 테두리/글자 | 배경 | 글로우 |
| --- | --- | --- | --- |
| 2, 4 | 텍스트색(민트) | surface-2보다 살짝 밝게 | 없음 |
| 8, 16 | 그린 | 그린 8~12% | 약하게 |
| 32, 64 | 옐로 | 옐로 8~12% | 약하게 |
| 128, 256 | 핑크 | 핑크 10~14% | 중간 |
| 512, 1024 | 시안 | 시안 12~16% | 중간 |
| 2048 이상 | 배경 시안/핑크 채움 + 글자 `--color-on-accent` | 채움 | 강하게 |

  - 라이트 테마: 같은 색 계열을 블로그 라이트 변수(진한 시안 `#007c99`, 마젠타 `#c0008f` 등)로 바꾸고 글로우는 없앱니다. 글자 대비를 다시 확인합니다.
- 숫자 자릿수에 따라 글자 크기 축소: 1~2자리 기준, 3자리 약 85%, 4자리 약 70%, 5자리 이상 약 58% (`data-digits` 속성 + CSS).

### 3.3 크기와 반응형 (모바일 우선)

- 바깥 좌우 여백 최소 16px, 어떤 폭에서도 가로 스크롤 없음.
- 보드 너비: `width: min(100vw - 32px, 480px)`(정확히는 `min(calc(100vw - 32px), 480px)`), `aspect-ratio: 1`.
  - 칸 간격(gap)과 안쪽 여백: 모바일 8px, `min-width: 520px` 이상 12px.
  - **375px 폭**: 보드 343px → 칸 하나 약 (343 − 5×8) / 4 ≈ **75.75px**. 1~2자리 숫자 약 2rem, 4자리 약 1.4rem.
  - 데스크톱: 보드 최대 480px → 칸 약 105px.
- 칸 크기는 CSS 변수(`--cell`, `--gap`)로 계산하고, 타일 위치는 `transform: translate(calc(var(--col) * (var(--cell) + var(--gap))), ...)`처럼 CSS 변수로 지정해 JS가 픽셀을 계산하지 않게 합니다(화면 크기가 바뀌어도 자동 대응).
- 헤더 점수판은 좁은 폭에서 두 줄로 줄바꿈되도록 `flex-wrap`.
- 세로가 짧은 가로 모드 휴대폰: 보드 너비를 `min(..., 100svh - 헤더 높이)`로 제한해 한 화면에 들어오게 합니다.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` 포함. 더블 탭 확대 방지를 위해 보드에 `touch-action: none`(보드 밖은 확대 가능하게 둠).

---

## 4. Embed 계획 (블로그 메인에 웹앱 카드 넣기)

### 4.1 현재 구조 파악 (코드 확인 결과)

- `index.html`에는 글 목록 마크업이 없고 `<main id="app">` 빈 컨테이너만 있습니다. 사이드바는 `aside.sidebar`(로고, 테마 토글, 태그 내비 `#tag-nav`).
- 글 목록은 `js/main.js`의 `renderList(posts, tag)`가 `setPage()`로 `#app.innerHTML`에 그립니다. 홈(`#/`)과 태그 화면(`#/tag/x`)이 같은 함수를 씁니다.
- 카드 스타일은 `css/style.css`의 `.post-list`(720px 이상 2열 그리드, `.post-item:first-child`가 두 칸 차지), `.post-card`(제목 링크 `::after`로 카드 전체 클릭).
- 따라서 CLAUDE.md의 "index.html에 카드 추가"는 실제로는 **`js/main.js` + `css/style.css` 수정**으로 해야 합니다. `index.html`은 바꾸지 않아도 됩니다(사이드바 링크를 추가하기로 할 때만 수정).

### 4.2 방식: 앱 목록 매니페스트 `apps/apps.json`

웹앱이 늘어날 것을 고려해 글 매니페스트(`posts/posts.json`)와 같은 방식으로 앱 목록을 둡니다.

```json
[
  {
    "id": "2048",
    "title": "2048",
    "description": "방향키·스와이프로 숫자 타일을 밀어 합치는 퍼즐 게임. 최고 점수 저장.",
    "path": "apps/2048/",
    "preview": { "type": "iframe", "src": "apps/2048/?preview=1" },
    "tags": ["게임", "퍼즐"],
    "date": "2026-10-15"
  }
]
```

- `preview.type`이 `"image"`면 `src`에 이미지 경로(`apps/2048/preview.svg`)와 `alt`를 둡니다.
- 정렬: `date` 최신순(JS에서 정렬).

### 4.3 변경할 파일과 내용

**① 새 파일 `apps/apps.json`** — 위 형식으로 2048 한 항목.

**② `js/main.js`**

- 상수 추가: `const APPS_MANIFEST = 'apps/apps.json';`
- `loadApps()` 추가: `loadPosts()`와 같은 캐시 패턴(`appsPromise`), `FETCH_OPTIONS` 사용. **실패하면 빈 배열을 반환**해 앱 목록 오류가 글 목록 표시를 막지 않게 합니다(에러는 `console.warn`으로만).
- 경로 검증 함수 `safeAppPath(value)`: `apps/`로 시작하고 `..`, `:`(스킴), 앞쪽 `/`가 없는 상대 경로만 허용, 아니면 해당 항목 건너뜀. 모든 텍스트는 기존 `escapeHtml`로 이스케이프(코드 규칙: `innerHTML` 값은 이스케이프 필수).
- `renderAppList(apps)` 추가: 아래 마크업 문자열 반환.

  ```html
  <section class="app-section" aria-labelledby="app-heading">
    <p class="prompt">&gt; ls ./apps</p>
    <h2 class="section-heading" id="app-heading">웹앱</h2>
    <ul class="app-list">
      <li class="app-item">
        <article class="app-card">
          <div class="app-preview" aria-hidden="true">
            <iframe src="apps/2048/?preview=1" title="2048 미리보기" loading="lazy"
                    tabindex="-1" scrolling="no"></iframe>
          </div>
          <h3 class="app-card-title"><a href="apps/2048/">2048</a></h3>
          <p class="app-card-desc">…</p>
          <ul class="tag-list">…</ul>   <!-- 태그는 표시만, 링크 없음(글 태그 라우트와 섞이지 않게) -->
        </article>
      </li>
    </ul>
  </section>
  ```

- `route()`의 홈 분기(`!section`)에서 `const [posts, apps] = await Promise.all([loadPosts(), loadApps()])`처럼 함께 불러와 `renderList(posts, undefined, apps)`로 전달. `renderList`에 세 번째 인자 `apps = []`를 추가하고, **태그 화면이 아닐 때만** 앱 섹션을 붙입니다(위치는 결정 사항 참고, 추천: 글 목록 아래).
- 앱 링크는 `#/`로 시작하지 않는 일반 상대 링크라 기존 앵커 클릭 핸들러(`a[href^="#"]`)와 충돌하지 않습니다. 앱 페이지는 블로그 SPA 밖의 별도 페이지로 이동합니다(같은 탭).

**③ `css/style.css`** (기존 변수만 사용)

- `.app-section { margin-top: 56px; }`, `.section-heading`(page-heading보다 작은 시안 제목, 글로우).
- `.app-list`: `.post-list`와 같은 그리드(모바일 1열, 720px 이상 2열). **`.post-item:first-child` 두 칸 규칙이 적용되지 않도록 별도 클래스**(`.app-item`)를 씁니다.
- `.app-card`: `.post-card`와 같은 테두리·배경·hover 글로우·`translateY(-2px)`(reduced-motion에서는 기존 규칙처럼 transform 없음).
- `.app-card-title a::after { content: ""; position: absolute; inset: 0; }`로 카드 전체를 클릭 영역으로.
- `.app-preview`: `aspect-ratio: 4 / 3`(또는 1/1), `overflow: hidden`, 테두리, 배경 `--color-bg`.
  - `.app-preview iframe { width: 100%; height: 100%; border: 0; pointer-events: none; display: block; }` — 클릭이 iframe에 먹히지 않고 카드 링크로 가게 합니다. 미리보기 모드 앱은 iframe 크기에 맞춰 반응형으로 그려지므로 `transform: scale` 계산은 필요 없습니다.
- 이미지 미리보기일 경우 `.app-preview img { width: 100%; height: 100%; object-fit: cover; }`.

**④ (선택) `index.html`** — 사이드바에 `APPS` 제목과 앱 링크 목록을 추가하려면 `nav.side-nav` 아래에 `<nav class="side-nav" aria-labelledby="app-nav-heading">`를 추가하고 `main.js`에서 채웁니다. 추천: 이번에는 하지 않음(메인 카드만).

**⑤ 커밋** — Embed 변경(`apps/apps.json`, `js/main.js`, `css/style.css`)과 앱 파일을 커밋. 작성자 이메일은 GitHub noreply 주소.

### 4.4 iframe 미리보기 주의점

- `loading="lazy"`로 첫 화면 로딩 부담을 줄입니다.
- `tabindex="-1"` + 래퍼 `aria-hidden="true"`로 키보드·스크린리더가 iframe 안으로 들어가지 않게 합니다(카드 제목 링크 하나만 포커스 대상).
- 미리보기 모드 앱은 입력·저장을 하지 않으므로 블로그에서 방향키를 눌러도 영향이 없습니다(iframe은 포커스를 받지 않음).
- `sandbox`를 쓰면 같은 출처 `localStorage`(테마) 읽기에 `allow-same-origin allow-scripts`가 필요해 사실상 의미가 없으므로 생략합니다(같은 저장소의 신뢰된 파일).

---

## 5. Review 체크리스트

### 동작

- [ ] `http://localhost:8000/apps/2048/` 에서 시작 시 타일 정확히 2개.
- [ ] 1.2 표의 모든 예시가 4방향에서 맞게 동작(콘솔에서 `slideLine` 직접 호출로도 확인).
- [ ] 한 이동에서 같은 타일이 두 번 합쳐지지 않음(`2 2 4 _` → `4 4 _ _`).
- [ ] 유효하지 않은 이동에서 새 타일이 생기지 않고 점수가 변하지 않음.
- [ ] 새 타일 값이 2 또는 4만 나옴(여러 번 시도해 4가 가끔 나오는지).
- [ ] 점수 = 합쳐진 값의 합. 최고 점수가 넘을 때 즉시 갱신되고 새로고침 후에도 유지.
- [ ] 새 게임 버튼이 보드·현재 점수를 초기화하고 최고 점수는 유지.
- [ ] 2048 달성 시 승리 오버레이 1회, 계속하기 후 진행 가능, 다시 뜨지 않음(테스트용으로 콘솔에서 보드를 주입하거나 `deserialize`로 거의 이긴 판 불러오기).
- [ ] 꽉 찼지만 합칠 수 있는 판은 게임 오버가 아님 / 진짜 막힌 판은 게임 오버.
- [ ] 진행 상태 저장을 채택했다면 새로고침 후 같은 판이 이어짐, 깨진 저장값을 넣어도 오류 없이 새 게임.
- [ ] `localStorage`를 막은 환경(콘솔에서 `Storage.prototype.setItem`을 throw하도록 바꿔 테스트)에서도 게임 동작.

### 입력·접근성

- [ ] 방향키·WASD(대문자, 한글 자판 상태 포함) 모두 동작, 방향키로 페이지가 스크롤되지 않음.
- [ ] Ctrl/Cmd+방향키 등 브라우저 단축키를 가로채지 않음.
- [ ] 오버레이가 열려 있을 때 이동 입력 무시, 포커스가 오버레이 버튼으로 이동하고 닫히면 복귀, Tab이 밖으로 새지 않음.
- [ ] 키보드만으로 새 게임·계속하기·다시 하기 가능, `:focus-visible` 외곽선 보임.
- [ ] live 영역 문구가 이동마다 갱신(접근성 트리 또는 스크린리더로 확인).
- [ ] `prefers-reduced-motion: reduce` 에뮬레이션에서 애니메이션 없이 즉시 배치.

### 모바일·레이아웃

- [ ] 375px / 768px / 1280px에서 가로 스크롤 없음, 보드가 화면 안에 정사각형으로 들어옴.
- [ ] 375px에서 4자리 숫자(1024, 2048)가 칸 밖으로 넘치지 않음.
- [ ] 모바일 에뮬레이션에서 스와이프 4방향 동작, 짧은 탭은 무시, 보드 위 스와이프 시 페이지가 스크롤되지 않음.
- [ ] 버튼 터치 영역 44×44px 이상.
- [ ] 다크(기본)·라이트 모두 타일 숫자와 본문 대비 4.5:1 이상. 블로그에서 라이트로 바꾸면 앱도 라이트로 열림.

### 코드·기타

- [ ] 브라우저 콘솔 오류·경고 없음(404 포함, 네트워크 탭 확인).
- [ ] 모든 경로가 상대 경로(`/`로 시작하는 경로 없음) — GitHub Pages 하위 경로 대비.
- [ ] `game.js`가 DOM·`localStorage`에 접근하지 않음(순수성).
- [ ] `innerHTML`에 사용자/저장 데이터를 넣지 않음.
- [ ] `?preview=1`에서 입력이 꺼지고 `localStorage`에 쓰지 않음(최고 점수 불변).
- [ ] 빠르게 연속 입력해도 타일 요소가 남거나 겹쳐 보이지 않음(DOM 타일 수 = 보드 타일 수, 애니메이션 종료 후).
- [ ] 창 크기를 바꿔도 타일 위치가 칸에 맞음.

### Embed 후

- [ ] 블로그 홈에 웹앱 카드가 보이고 태그 화면에는 보이지 않음.
- [ ] 카드 어디를 눌러도 `apps/2048/`로 이동, iframe이 클릭을 가로채지 않음, Tab 순서에 iframe이 없음.
- [ ] `apps/apps.json`이 없거나 깨져도 글 목록은 정상 표시.
- [ ] 기존 글 목록의 "첫 카드 두 칸" 레이아웃이 그대로 유지.
- [ ] 앱 페이지의 "블로그로 돌아가기"가 `../../`로 홈에 도착(GitHub Pages 하위 경로 포함).

---

## 6. 사용자에게 확인받을 결정 사항

| # | 항목 | 선택지 | 추천 |
| --- | --- | --- | --- |
| 1 | 블로그 카드 미리보기 | (a) iframe `?preview=1` 실제 앱 축소 표시 / (b) 정적 이미지(SVG·PNG) | **(a) iframe** — 별도 이미지 관리가 필요 없고 테마도 자동으로 따라감. 앱이 많아져 무거워지면 (b)로 전환 |
| 2 | 앱 목록 관리 | (a) `apps/apps.json` 매니페스트 / (b) `main.js`에 직접 배열로 하드코딩 | **(a) 매니페스트** — 앱 추가 시 JSON 한 줄만 추가 |
| 3 | 카드 위치 | (a) 홈 글 목록 **아래** "웹앱" 섹션 / (b) 글 목록 **위** / (c) 별도 `#/apps` 화면 + 사이드바 링크 | **(a) 아래** — 기존 "최근 글" 제목·첫 카드 강조 구조를 해치지 않음. 앱이 3개 이상 되면 (c) 검토 |
| 4 | 앱 안 테마 토글 | (a) 앱에도 토글 버튼(블로그와 같은 `theme` 키 저장) / (b) 블로그 설정만 따름 | **(a) 제공** — 앱을 단독으로 열어도 바꿀 수 있음 |
| 5 | 진행 상태 저장(새로고침 후 이어하기) | 저장함 / 안 함 | **저장함** |
| 6 | 되돌리기(Undo) | 포함 / 미포함 | **미포함**(원작 규칙, 범위 최소화) |
| 7 | 화면 방향 버튼(↑↓←→) | 포함 / 미포함 | **미포함** — 키보드·스와이프로 충분. 필요 시 후속 |
| 8 | 진행 중 새 게임 확인 | (a) 확인 없이 바로 / (b) 버튼 한 번 더 누르면 시작("정말? 다시 누르기") / (c) 앱 내부 확인 대화상자 | **(b)** — 가볍고 실수 방지 |
| 9 | 애니메이션 속도 | 이동 120ms / 100ms / 150ms | **120ms** |
| 10 | localStorage 키 이름 | `my-blog:2048:best`, `my-blog:2048:state` | 이대로 |

> **승인 (2026-10-15):** 사용자가 위 10개 항목을 모두 **추천안 그대로** 승인했다. Build는 이 결정을 따른다.
