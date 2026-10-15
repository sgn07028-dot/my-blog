import { parseMarkdown, escapeHtml } from './markdown.js';
import { initThemeToggle } from './theme.js';

const SITE_TITLE = 'My Blog';
const POSTS_DIR = 'posts/';
const APPS_MANIFEST = 'apps/apps.json';
// 새 글을 올려도 브라우저가 예전 목록을 보여 주지 않도록 매번 서버에 변경 여부를 확인한다
const FETCH_OPTIONS = { cache: 'no-cache' };

const app = document.getElementById('app');
const tagNav = document.getElementById('tag-nav');
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

let postsPromise = null;
let appsPromise = null;
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

// apps/ 아래 상대 경로만 허용해 매니페스트에 잘못된 경로가 들어와도 다른 곳으로 이동하지 않게 한다
function safeAppPath(value) {
  const path = String(value || '');
  if (!path.startsWith('apps/') || path.includes('..') || path.includes(':') || path.includes('\\')) return null;
  return path;
}

// 앱 목록은 부가 정보라서, 불러오지 못해도 글 목록은 그대로 보여 준다
function loadApps() {
  if (!appsPromise) {
    appsPromise = fetch(APPS_MANIFEST, FETCH_OPTIONS)
      .then((res) => {
        if (!res.ok) throw new Error(`apps.json을 불러오지 못했습니다 (${res.status})`);
        return res.json();
      })
      .then((list) =>
        (Array.isArray(list) ? list : [])
          .map((item) => ({
            ...item,
            path: safeAppPath(item.path),
            previewSrc: item.preview ? safeAppPath(item.preview.src) : null,
            tags: Array.isArray(item.tags) ? item.tags : [],
          }))
          .filter((item) => item.path && item.title)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      )
      .catch((err) => {
        console.warn(err);
        appsPromise = null;
        return [];
      });
  }
  return appsPromise;
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

function setPage(title, html, view) {
  document.title = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE;
  app.innerHTML = `<div class="view view-${view}">${html}</div>`;
}

// 사이드바 태그 목록: 글이 많은 태그부터 보여 주고 지금 보고 있는 태그를 표시한다
function renderTagNav(posts, activeTag) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  const item = (href, label, count, active) =>
    `<li><a href="${href}"${active ? ' aria-current="page"' : ''}>` +
    `<span class="tag-nav-label">${label}</span><span class="tag-nav-count">${count}</span></a></li>`;

  tagNav.innerHTML =
    item('#/', '전체 글', posts.length, activeTag === '') +
    sorted.map(([tag, count]) => item(`#/tag/${encodeURIComponent(tag)}`, `#${escapeHtml(tag)}`, count, tag === activeTag)).join('');
}

/* ===== 화면 ===== */

function renderAppList(apps) {
  if (!apps.length) return '';
  const items = apps
    .map((item) => {
      const title = escapeHtml(item.title);
      const preview =
        item.preview && item.preview.type === 'image' && item.previewSrc
          ? `<img src="${escapeHtml(item.previewSrc)}" alt="" loading="lazy">`
          : item.previewSrc
            ? `<iframe src="${escapeHtml(item.previewSrc)}" title="${title} 미리보기" loading="lazy" tabindex="-1" scrolling="no"></iframe>`
            : '';
      // 앱 태그는 글 태그 화면과 섞이지 않도록 링크 없이 표시만 한다
      const tags = item.tags.length
        ? `<ul class="tag-list">${item.tags.map((tag) => `<li><span class="tag">#${escapeHtml(tag)}</span></li>`).join('')}</ul>`
        : '';
      return `
      <li class="app-item">
        <article class="app-card">
          ${preview ? `<div class="app-preview" aria-hidden="true">${preview}</div>` : ''}
          <h3 class="app-card-title"><a href="${escapeHtml(item.path)}">${title}</a></h3>
          ${item.description ? `<p class="app-card-desc">${escapeHtml(item.description)}</p>` : ''}
          ${tags}
        </article>
      </li>`;
    })
    .join('');

  return `<section class="app-section" aria-labelledby="app-heading">
      <p class="prompt">&gt; ls ./apps</p>
      <h2 class="section-heading" id="app-heading">웹앱</h2>
      <ul class="app-list">${items}</ul>
    </section>`;
}

function renderList(posts, tag, apps = []) {
  const heading = tag
    ? `<p class="prompt">&gt; grep -l "#${escapeHtml(tag)}" ./posts</p>
       <h1 class="page-heading">#${escapeHtml(tag)}</h1>
       <p class="page-subheading">${posts.length}개의 글 · <a href="#/">전체 글 보기</a></p>`
    : `<p class="prompt">&gt; ls -t ./posts</p>
       <h1 class="page-heading">최근 글</h1>
       <p class="page-subheading">마크다운으로 기록하는 생각과 배움 · ${posts.length}개의 글</p>`;

  const items = posts.length
    ? posts
        .map(
          (post, i) => `
      <li class="post-item">
        <article class="post-card">
          <span class="post-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <h2 class="post-item-title"><a href="#/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title || post.slug)}</a></h2>
          <div class="post-meta">${formatDate(post.date)}</div>
          ${post.description ? `<p class="post-item-desc">${escapeHtml(post.description)}</p>` : ''}
          ${tagList(post.tags)}
        </article>
      </li>`
        )
        .join('')
    : '<li class="post-item"><p class="status">아직 글이 없습니다.</p></li>';

  const appSection = tag ? '' : renderAppList(apps);
  setPage(tag ? `#${tag}` : '', `${heading}<ul class="post-list">${items}</ul>${appSection}`, 'list');
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
        <p class="prompt"><a class="back-link" href="#/">cd ..</a> <span aria-hidden="true">/</span> ~/posts/${escapeHtml(entry.file)}</p>
        <h1 class="post-title">${escapeHtml(post.title || slug)}</h1>
        <div class="post-meta">${formatDate(post.date)}</div>
        ${tagList(tags)}
      </header>
      <div class="prose">${html}</div>
    </article>
    ${nav}`,
    'post'
  );
}

function renderNotFound(message) {
  setPage(
    '페이지를 찾을 수 없음',
    `<div class="notice">
      <h1>404</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="#/">← 홈으로 돌아가기</a></p>
    </div>`,
    'notice'
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
    </div>`,
    'notice'
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
    const [posts, apps] = await Promise.all([loadPosts(), section ? [] : loadApps()]);
    if (id !== renderId) return;
    renderTagNav(posts, !section ? '' : section === 'tag' ? param : null);

    if (!section) {
      renderList(posts, undefined, apps);
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
