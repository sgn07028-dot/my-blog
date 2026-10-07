const STORAGE_KEY = 'theme';

function store(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장할 수 없는 환경(사생활 보호 모드 등)에서는 이번 방문 동안만 적용된다
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function apply(theme, button) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
}

// 기본 테마는 블랙 네온(dark)이고, 사용자가 라이트를 고르면 그 선택을 기억한다
export function initThemeToggle(button) {
  apply(currentTheme(), button);

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    apply(next, button);
    store(next);
  });
}
