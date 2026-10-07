---
title: 오늘 배운 것
date: 2026-10-06
description: 클로드 코드로 블로그를 만들면서 알게 된 HTML, CSS, JavaScript의 역할을 정리했습니다.
tags: [TIL, 웹개발]
---

오늘은 클로드 코드와 함께 프레임워크 없이 이 블로그를 만들었습니다. 만들면서 웹페이지를 이루는 세 가지 언어가 각각 무슨 일을 하는지 조금 더 분명하게 알게 되어 정리해 둡니다.

> 한 줄 요약: **HTML은 뼈대, CSS는 옷, JavaScript는 움직임**이다.

## HTML — 페이지의 뼈대

HTML은 페이지에 **무엇이 있는지**를 정합니다. 제목, 문단, 링크, 버튼 같은 내용의 구조를 태그로 표시합니다.

- `index.html` 하나에 헤더, 본문 영역(`<main id="app">`), 푸터를 두었습니다.
- `header`, `main`, `article`, `nav`, `footer`처럼 의미가 담긴 태그(시맨틱 태그)를 쓰면 화면 낭독기나 검색 엔진도 구조를 이해하기 쉽습니다.
- `<meta name="viewport">` 한 줄이 있어야 모바일에서 화면이 제대로 보인다는 것도 배웠습니다.

```html
<header class="site-header">
  <a class="site-title" href="#/">My Blog</a>
  <button class="theme-toggle" aria-label="다크 모드로 전환">…</button>
</header>
```

## CSS — 페이지의 옷

CSS는 **어떻게 보일지**를 정합니다. 색, 글꼴, 여백, 배치를 담당합니다.

- 색을 직접 쓰지 않고 **CSS 변수**로 모아 두니, 다크 모드는 변수 값만 바꾸면 됐습니다.
- 카드 색을 핑크에서 초록으로 바꿀 때도 변수 두 개만 고쳤습니다.
- 작은 화면을 먼저 기준으로 만들고, `@media (min-width: 768px)`로 넓은 화면을 덧붙이는 **모바일 우선** 방식을 썼습니다.
- `word-break: keep-all`을 쓰면 한글 단어가 중간에 끊기지 않습니다.

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1f2328;
}

:root[data-theme="dark"] {
  --color-bg: #121417;
  --color-text: #e6e8eb;
}
```

## JavaScript — 페이지의 움직임

JavaScript는 **무엇을 할지**를 정합니다. 사용자 행동에 반응하고, 데이터를 불러와 화면을 바꿉니다.

1. `fetch`로 `posts.json`과 마크다운 파일을 불러옵니다.
2. 직접 만든 변환기가 마크다운을 HTML로 바꿉니다.
3. 주소의 `#/post/...` 부분을 보고 어떤 화면을 그릴지 정합니다(해시 라우팅).
4. 버튼을 누르면 테마를 바꾸고 `localStorage`에 저장합니다.

```javascript
button.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
});
```

## 셋을 한눈에 비교하면

| 언어 | 역할 | 이 블로그에서 맡은 일 |
| --- | --- | --- |
| HTML | 구조 | 헤더, 본문, 푸터의 뼈대 |
| CSS | 표현 | 색, 글꼴, 다크 모드, 반응형 |
| JavaScript | 동작 | 글 불러오기, 화면 전환, 테마 토글 |

## 덧붙여 배운 것

- 브라우저에서 `index.html`을 더블클릭해 열면 `fetch`가 막힙니다. 그래서 `python -m http.server` 같은 **로컬 서버**가 필요합니다.
- 사용자가 쓴 글을 HTML로 넣을 때는 반드시 **이스케이프**해야 `<script>` 같은 코드가 실행되지 않습니다.
- CSS를 고쳤는데 화면이 그대로라면 브라우저 캐시 때문일 수 있습니다. `Ctrl+Shift+R`로 강력 새로고침하면 됩니다.

세 언어가 각자 맡은 일이 분명해서, 파일도 역할별로 나누어 두니 고칠 곳을 찾기가 훨씬 쉬웠습니다. 다음에는 글 검색 기능을 만들어 보고 싶습니다.
