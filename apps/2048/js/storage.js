// localStorage 래퍼. 사생활 보호 모드 등에서 접근이 막혀도 게임은 그대로 동작해야 하므로 모든 접근을 try/catch로 감싼다.

const BEST_KEY = 'my-blog:2048:best';
const STATE_KEY = 'my-blog:2048:state';
// 블로그와 같은 키를 써서 테마 선택을 공유한다
export const THEME_KEY = 'theme';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장할 수 없는 환경에서는 이번 방문 동안만 유지된다
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // 지울 수 없어도 다음 로드 때 형식 검증에서 걸러진다
  }
}

export function loadBest() {
  const value = Number(read(BEST_KEY));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function saveBest(value) {
  if (Number.isSafeInteger(value) && value > 0) {
    write(BEST_KEY, String(value));
  }
}

// 파싱만 하고 형식 검증은 game.deserialize가 맡는다
export function loadState() {
  const raw = read(STATE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(obj) {
  write(STATE_KEY, JSON.stringify(obj));
}

export function clearState() {
  remove(STATE_KEY);
}

export function loadTheme() {
  return read(THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function saveTheme(theme) {
  write(THEME_KEY, theme === 'light' ? 'light' : 'dark');
}
