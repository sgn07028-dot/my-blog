const STORAGE_KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function store(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장할 수 없는 환경(사생활 보호 모드 등)에서는 이번 방문 동안만 적용된다
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme, button) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
}

export function initThemeToggle(button) {
  apply(readStored() || currentTheme(), button);

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    apply(next, button);
    store(next);
  });

  // 사용자가 직접 고른 적이 없을 때만 OS 설정 변경을 따라간다
  media.addEventListener('change', (event) => {
    if (!readStored()) apply(event.matches ? 'dark' : 'light', button);
  });
}
