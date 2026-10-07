import { parseMarkdown, escapeHtml } from './markdown.js';
import { initThemeToggle } from './theme.js';

const SITE_TITLE = 'My Blog';
const POSTS_DIR = 'posts/';
// 새 글을 올려도 브라우저가 예전 목록을 보여 주지 않도록 매번 서버에 변경 여부를 확인한다
const FETCH_OPTIONS = { cache: 'no-cache' };

const app = document.getElementById('app');
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

let postsPromise = null;
// 빠르게 이동할 때 늦게 도착한 이전 요청이 화면을 덮어쓰지 않게 한다
let renderId = 0;

function slugFromFile(file) {
  return file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function loadPosts() {
  if (!postsPromise) {
    postsPromise = fetch(`${POSTS_DIR}posts.json`, FETCH_OPTIONS)
      .then((res) => {
        if (!res.ok) throw new Error(`posts.json을 불러오지 못했습니다 (${res.status})`);
        return res.json();
      })
      .then((list) =>
        list
          .map((post) => ({ ...post, slug: slugFromFile(post.file), tags: post.tags || [] }))
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      )
      .catch((err) => {
        postsPromise = null; // 다음 이동 때 다시 시도할 수 있게 한다
        throw err;
      });
  }
  return postsPromise;
}

// 'YYYY-MM-DD'를 그대로 new Date()에 넣으면 UTC로 해석돼 날짜가 하루 밀릴 수 있다
function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return escapeHtml(value || '');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return `<time datetime="${match[0]}">${dateFormatter.format(date)}</time>`;
}

function tagList(tags) {
  if (!tags || !tags.length) return '';
  const items = tags
    .map((tag) => `<li><a class="tag" href="#/tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a></li>`)
    .join('');
  return `<ul class="tag-list">${items}</ul>`;
}

function setPage(title, html) {
  document.title = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE;
  app.innerHTML = html;
}

/* ===== 화면 ===== */

function renderList(posts, tag) {
  const heading = tag
    ? `<a class="back-link" href="#/">← 전체 글</a>
       <h1 class="page-heading">#${escapeHtml(tag)}</h1>
       <p class="page-subheading">${posts.length}개의 글</p>`
    : `<h1 class="page-heading">최근 글</h1>
       <p class="page-subheading">마크다운으로 기록하는 생각과 배움</p>`;

  const items = posts.length
    ? posts
        .map(
          (post) => `
      <li class="post-item">
        <article>
          <h2 class="post-item-title"><a href="#/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title || post.slug)}</a></h2>
          <div class="post-meta">${formatDate(post.date)}</div>
          ${post.description ? `<p class="post-item-desc">${escapeHtml(post.description)}</p>` : ''}
          ${tagList(post.tags)}
        </article>
      </li>`
        )
        .join('')
    : '<li class="post-item"><p class="status">아직 글이 없습니다.</p></li>';

  setPage(tag ? `#${tag}` : '', `${heading}<ul class="post-list">${items}</ul>`);
}

async function renderPost(posts, slug, id) {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) {
    renderNotFound('요청한 글을 찾을 수 없습니다.');
    return;
  }

  const entry = posts[index];
  const res = await fetch(POSTS_DIR + entry.file, FETCH_OPTIONS);
  if (!res.ok) throw new Error(`글을 불러오지 못했습니다 (${res.status})`);
  const { meta, html } = parseMarkdown(await res.text());
  if (id !== renderId) return;

  // front matter 값이 매니페스트보다 우선한다
  const post = { ...entry, ...meta };
  const tags = Array.isArray(post.tags) ? post.tags : [post.tags].filter(Boolean);
  const older = posts[index + 1];
  const newer = posts[index - 1];
  const navLink = (target, label, cls) =>
    target
      ? `<a class="${cls}" href="#/post/${encodeURIComponent(target.slug)}">
           <span class="post-nav-label">${label}</span>${escapeHtml(target.title || target.slug)}
         </a>`
      : '';
  const nav =
    older || newer
      ? `<nav class="post-nav" aria-label="다른 글">${navLink(older, '← 이전 글', 'prev')}${navLink(newer, '다음 글 →', 'next')}</nav>`
      : '';

  setPage(
    post.title,
    `<article>
      <header class="post-header">
        <a class="back-link" href="#/">← 목록으로</a>
        <h1 class="post-title">${escapeHtml(post.title || slug)}</h1>
        <div class="post-meta">${formatDate(post.date)}</div>
        ${tagList(tags)}
      </header>
      <div class="prose">${html}</div>
    </article>
    ${nav}`
  );
}

function renderNotFound(message) {
  setPage(
    '페이지를 찾을 수 없음',
    `<div class="notice">
      <h1>404</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="#/">← 홈으로 돌아가기</a></p>
    </div>`
  );
}

function renderError(err) {
  const hint =
    location.protocol === 'file:'
      ? '<p>파일을 직접 열면 브라우저가 글을 읽을 수 없습니다. 프로젝트 폴더에서 <code>python -m http.server 8000</code>을 실행한 뒤 <code>http://localhost:8000</code>으로 접속해 주세요.</p>'
      : '<p>잠시 후 새로고침해 주세요.</p>';
  setPage(
    '오류',
    `<div class="notice">
      <h1>글을 불러오지 못했습니다</h1>
      <p>${escapeHtml(err.message || String(err))}</p>
      ${hint}
      <p><a href="#/">← 홈으로 돌아가기</a></p>
    </div>`
  );
}

/* ===== 라우터 ===== */

function parseRoute() {
  const hash = location.hash.slice(1);
  // '#/'로 시작하지 않는 해시(본문 앵커 등)는 홈으로 본다
  const path = hash.startsWith('/') ? hash : '/';
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

async function route() {
  const id = ++renderId;
  const [section, param, ...rest] = parseRoute();

  try {
    const posts = await loadPosts();
    if (id !== renderId) return;

    if (!section) {
      renderList(posts);
    } else if (section === 'post' && param && !rest.length) {
      await renderPost(posts, param, id);
    } else if (section === 'tag' && param && !rest.length) {
      renderList(posts.filter((post) => post.tags.includes(param)), param);
    } else {
      renderNotFound('요청한 페이지가 없습니다.');
    }
  } catch (err) {
    if (id === renderId) renderError(err);
  }
}

// 해시 라우팅과 겹치지 않도록 '#제목' 같은 본문 앵커는 직접 스크롤한다
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (href === '#' || href.startsWith('#/')) return;

  event.preventDefault();
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(href.slice(1)));
  } catch {
    target = null;
  }
  if (!target) return;
  target.scrollIntoView({ block: 'start' });
  if (target === app) app.focus({ preventScroll: true });
});

window.addEventListener('hashchange', () => {
  if (location.hash && !location.hash.startsWith('#/')) return;
  window.scrollTo(0, 0);
  route().then(() => app.focus({ preventScroll: true }));
});

document.getElementById('year').textContent = new Date().getFullYear();
initThemeToggle(document.querySelector('.theme-toggle'));
route();
