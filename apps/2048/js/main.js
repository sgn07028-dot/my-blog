// 시작점: 상태를 보관하고 입력 → game → render → storage를 잇는다. ?preview=1이면 데모 보드만 그린다.
import { createGame, move, continueGame, serialize, deserialize } from './game.js';
import { createRenderer } from './render.js';
import { bindInput } from './input.js';
import {
  loadBest,
  saveBest,
  loadState,
  saveState,
  clearState,
  loadTheme,
  saveTheme,
  THEME_KEY,
} from './storage.js';

const CONFIRM_TIMEOUT_MS = 3000;
// 이동·합치기 애니메이션(120ms + 150ms)이 끝난 뒤 오버레이를 띄운다
const OVERLAY_DELAY_MS = 300;

const DIRECTION_LABELS = {
  up: '위쪽',
  down: '아래쪽',
  left: '왼쪽',
  right: '오른쪽',
};

// 미리보기용 고정 배치(무작위 없음)
const PREVIEW_CELLS = [
  2, 4, 8, 16,
  256, 128, 64, 32,
  512, 1024, 2048, 4,
  0, 2, 0, 8,
];
const PREVIEW_SCORE = 20480;

const root = document.documentElement;
const isPreview = new URLSearchParams(location.search).get('preview') === '1';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const els = {
  board: document.getElementById('board'),
  tiles: document.getElementById('tiles'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  scoreDelta: document.getElementById('score-delta'),
  live: document.getElementById('live'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayMessage: document.getElementById('overlay-message'),
  overlayPrimary: document.getElementById('overlay-primary'),
  overlaySecondary: document.getElementById('overlay-secondary'),
};
const newGameButton = document.getElementById('new-game');
const themeToggle = document.getElementById('theme-toggle');

const renderer = createRenderer(els, { reducedMotion: () => reducedMotionQuery.matches });

let state = null;
let best = 0;
let bestAtStart = 0;
let overlayType = null;
let overlayTimer = 0;
let confirmTimer = 0;
let confirmPending = false;

/* ===== 테마 ===== */
function applyTheme(theme) {
  root.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
  }
}

function initTheme() {
  applyTheme(loadTheme());
  // 블로그(다른 탭·부모 페이지)에서 테마를 바꾸면 미리보기 iframe을 포함해 바로 따라간다
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      applyTheme(event.newValue === 'light' ? 'light' : 'dark');
    }
  });
  if (themeToggle && !isPreview) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      saveTheme(next);
    });
  }
}

// 저장 형식(serialize)에 판 시작 시점의 최고 점수를 덧붙인다. deserialize는 모르는 필드를 무시한다
function persistState() {
  saveState({ ...serialize(state), bestAtStart });
}

/* ===== 오버레이 ===== */
function isBlocked() {
  return overlayType !== null || state.over || (state.won && !state.keepPlaying);
}

function openOverlay(type, info) {
  clearTimeout(overlayTimer);
  overlayType = type;
  renderer.showOverlay(type, info);
}

function scheduleOverlay(type, info) {
  clearTimeout(overlayTimer);
  const delay = reducedMotionQuery.matches ? 0 : OVERLAY_DELAY_MS;
  overlayTimer = setTimeout(() => openOverlay(type, info), delay);
}

function closeOverlay() {
  clearTimeout(overlayTimer);
  // close 이벤트 처리기가 "사용자가 닫음"으로 오해하지 않도록 먼저 비운다
  overlayType = null;
  renderer.hideOverlay();
}

function keepPlaying() {
  state = continueGame(state);
  persistState();
  closeOverlay();
  renderer.announce('게임을 계속합니다.');
}

function gameOverInfo() {
  return { score: state.score, best, newBest: state.score > bestAtStart };
}

function initOverlay() {
  els.overlay.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    if (button.dataset.action === 'continue') {
      keepPlaying();
    } else if (button.dataset.action === 'new-game') {
      startNewGame();
    }
  });

  // Esc: 승리 안내에서는 "계속하기"와 같고, 게임 오버 안내는 닫지 않는다
  els.overlay.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (overlayType === 'win') {
      keepPlaying();
    }
  });

  // 브라우저가 cancel을 무시하고 강제로 닫은 경우(Esc 연타 등)에도 상태를 맞춘다
  els.overlay.addEventListener('close', () => {
    if (overlayType === 'win') {
      keepPlaying();
    } else if (overlayType !== null) {
      overlayType = null;
      els.board.focus({ preventScroll: true });
    }
  });
}

/* ===== 새 게임 (진행 중이면 한 번 더 눌러야 시작) ===== */
function resetConfirm() {
  clearTimeout(confirmTimer);
  confirmPending = false;
  newGameButton.textContent = 'new_game';
  newGameButton.classList.remove('is-confirm');
}

function startNewGame() {
  resetConfirm();
  state = createGame();
  bestAtStart = best;
  renderer.render(state);
  persistState();
  if (overlayType !== null || els.overlay.open) {
    closeOverlay();
  }
  clearTimeout(overlayTimer);
  renderer.announce('새 게임을 시작했습니다.');
}

function handleNewGameClick() {
  const inProgress = state.score > 0 && !state.over;
  if (inProgress && !confirmPending) {
    confirmPending = true;
    newGameButton.textContent = '정말? 다시 누르기';
    newGameButton.classList.add('is-confirm');
    renderer.announce('진행 중인 게임이 있습니다. 새 게임을 시작하려면 한 번 더 누르세요.');
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(resetConfirm, CONFIRM_TIMEOUT_MS);
    return;
  }
  startNewGame();
}

/* ===== 이동 ===== */
function moveMessage(direction, result) {
  const parts = [`${DIRECTION_LABELS[direction]}으로 이동.`];
  if (result.mergedValues.length > 0) {
    parts.push(`${result.mergedValues.join(', ')} 만듦, +${result.scoreGained}점.`);
  }
  parts.push(`점수 ${result.state.score}.`);
  return parts.join(' ');
}

function handleMove(direction) {
  if (isBlocked()) {
    return;
  }
  if (confirmPending) {
    resetConfirm();
  }

  const wasWon = state.won;
  const result = move(state, direction);
  if (!result.moved) {
    renderer.announce('움직일 수 없는 방향입니다.');
    return;
  }

  state = result.state;
  if (state.score > best) {
    best = state.score;
    saveBest(best);
    renderer.setBest(best);
  }
  renderer.render(state, result);

  if (state.over) {
    clearState();
    renderer.announce(`${moveMessage(direction, result)} 더 이상 움직일 수 없습니다.`);
    scheduleOverlay('over', gameOverInfo());
    return;
  }

  persistState();
  if (state.won && !wasWon && !state.keepPlaying) {
    renderer.announce(`${moveMessage(direction, result)} 2048을 만들었습니다!`);
    scheduleOverlay('win', { score: state.score });
    return;
  }
  renderer.announce(moveMessage(direction, result));
}

/* ===== 시작 ===== */
function initPreview() {
  // 미리보기는 입력·저장을 모두 끈다(블로그 메인에서 최고 점수·진행 상태를 덮어쓰지 않게)
  const demo = { ...serialize(createGame({ rng: () => 0 })), cells: PREVIEW_CELLS, score: PREVIEW_SCORE, won: true, keepPlaying: true };
  state = deserialize(demo);
  els.board.removeAttribute('tabindex');
  renderer.render(state);
  renderer.setBest(PREVIEW_SCORE);
}

function initGame() {
  best = loadBest();
  const raw = loadState();
  const saved = raw ? deserialize(raw) : null;

  if (saved && !saved.over) {
    state = saved;
    // 이어하기한 판도 "판을 시작할 때의 최고 점수"로 갱신 여부를 판정한다
    const savedBestAtStart = raw.bestAtStart;
    bestAtStart = Number.isSafeInteger(savedBestAtStart) && savedBestAtStart >= 0
      ? Math.min(savedBestAtStart, best)
      : best;
  } else {
    if (raw) {
      // 깨졌거나 이미 끝난 저장값은 지우고 새 게임으로 시작한다
      clearState();
    }
    state = createGame();
    bestAtStart = best;
  }

  // 저장된 점수가 최고 점수보다 크면(최고 점수 저장만 실패한 경우) 맞춰 준다
  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }

  renderer.render(state);
  renderer.setBest(best);
  persistState();

  initOverlay();
  newGameButton.addEventListener('click', handleNewGameClick);
  bindInput({ board: els.board, onMove: handleMove, isBlocked });

  if (state.won && !state.keepPlaying) {
    openOverlay('win', { score: state.score });
  }
}

initTheme();
if (isPreview) {
  initPreview();
} else {
  initGame();
}
