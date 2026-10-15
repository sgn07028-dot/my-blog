// 상태 → DOM. 타일 요소를 id별로 재사용해 CSS transition으로 이동 애니메이션을 만든다.
// 숫자와 문구는 모두 textContent로만 넣는다(innerHTML 사용 안 함).

// style.css의 --move-ms와 같아야 합친 원본 타일이 도착한 뒤 제거된다
const MOVE_MS = 120;

function tierOf(value) {
  if (value <= 4) return 1;
  if (value <= 16) return 2;
  if (value <= 64) return 3;
  if (value <= 256) return 4;
  if (value <= 1024) return 5;
  if (value === 2048) return 6;
  return 7;
}

function setPosition(el, tile) {
  el.style.setProperty('--row', String(tile.row));
  el.style.setProperty('--col', String(tile.col));
}

function createTileElement(tile, classNames) {
  const el = document.createElement('div');
  el.className = ['tile', ...classNames].join(' ');
  el.dataset.tier = String(tierOf(tile.value));
  el.dataset.digits = String(Math.min(String(tile.value).length, 5));
  setPosition(el, tile);

  const inner = document.createElement('span');
  inner.className = 'tile-inner';
  inner.textContent = String(tile.value);
  el.appendChild(inner);
  return el;
}

const OVERLAYS = {
  win: (info) => ({
    title: '2048 달성!',
    message: `점수 ${info.score}. 계속해서 더 큰 숫자에 도전할 수 있습니다.`,
    primary: { label: '계속하기', action: 'continue' },
    secondary: { label: '새 게임', action: 'new-game' },
  }),
  over: (info) => ({
    title: '더 이상 움직일 수 없습니다',
    message: info.newBest
      ? `최종 점수 ${info.score} · 최고 점수를 갱신했습니다!`
      : `최종 점수 ${info.score} · 최고 점수 ${info.best}`,
    primary: { label: '다시 하기', action: 'new-game' },
    secondary: null,
  }),
};

export function createRenderer(elements, { reducedMotion = false } = {}) {
  const {
    board,
    tiles: tileLayer,
    score: scoreEl,
    best: bestEl,
    scoreDelta,
    live,
    overlay,
    overlayTitle,
    overlayMessage,
    overlayPrimary,
    overlaySecondary,
  } = elements;

  // 함수로 받으면 OS 설정이 바뀌어도 매번 최신 값을 쓴다
  const isReduced = typeof reducedMotion === 'function' ? reducedMotion : () => Boolean(reducedMotion);
  const tileEls = new Map();
  let pendingRemovals = [];
  let announceFrame = 0;

  // 빠른 연속 입력 시 이전 이동에서 제거 대기 중인 원본 타일을 바로 지워 요소가 남지 않게 한다
  function flushRemovals() {
    pendingRemovals.forEach(({ el, timer }) => {
      clearTimeout(timer);
      el.remove();
    });
    pendingRemovals = [];
  }

  function removeLater(el, animate) {
    if (!animate) {
      el.remove();
      return;
    }
    const entry = { el, timer: 0 };
    entry.timer = setTimeout(() => {
      el.remove();
      pendingRemovals = pendingRemovals.filter((item) => item !== entry);
    }, MOVE_MS);
    pendingRemovals.push(entry);
  }

  function addTile(tile, classNames) {
    const el = createTileElement(tile, classNames);
    tileLayer.appendChild(el);
    tileEls.set(tile.id, el);
  }

  function updateScore(score, gained, animate) {
    scoreEl.textContent = String(score);
    if (!scoreDelta) {
      return;
    }
    if (gained > 0 && animate) {
      scoreDelta.textContent = `+${gained}`;
      scoreDelta.classList.remove('is-active');
      // 클래스를 다시 붙여도 애니메이션이 처음부터 재생되도록 리플로를 강제한다
      void scoreDelta.offsetWidth;
      scoreDelta.classList.add('is-active');
    } else if (!animate) {
      scoreDelta.classList.remove('is-active');
      scoreDelta.textContent = '';
    }
  }

  // moveResult가 없으면 처음부터 다시 그린다(새 게임, 저장된 판 불러오기).
  function render(state, moveResult) {
    flushRemovals();
    const animate = !isReduced();

    if (!moveResult) {
      tileEls.forEach((el) => el.remove());
      tileEls.clear();
      state.board.forEach((tile) => {
        if (tile) {
          addTile(tile, animate && tile.isNew ? ['tile-new', 'tile-now'] : []);
        }
      });
      updateScore(state.score, 0, false);
      return;
    }

    const alive = new Set();
    state.board.forEach((tile) => {
      if (!tile) {
        return;
      }
      alive.add(tile.id);

      if (tile.mergedFrom) {
        // 원본 두 타일을 결과 칸까지 옮긴 뒤 지우고, 그 자리에 결과 타일을 보인다
        tile.mergedFrom.forEach((sourceId) => {
          const sourceEl = tileEls.get(sourceId);
          if (sourceEl) {
            setPosition(sourceEl, tile);
            tileEls.delete(sourceId);
            removeLater(sourceEl, animate);
          }
        });
        addTile(tile, animate ? ['tile-merged'] : []);
        return;
      }

      const el = tileEls.get(tile.id);
      if (el) {
        el.classList.remove('tile-new', 'tile-now', 'tile-merged');
        setPosition(el, tile);
      } else {
        addTile(tile, animate && tile.isNew ? ['tile-new'] : []);
      }
    });

    tileEls.forEach((el, id) => {
      if (!alive.has(id)) {
        el.remove();
        tileEls.delete(id);
      }
    });

    updateScore(state.score, moveResult.scoreGained, animate);
  }

  function setBest(value) {
    bestEl.textContent = String(value);
  }

  function setButton(button, config) {
    if (!config) {
      button.hidden = true;
      delete button.dataset.action;
      return;
    }
    button.hidden = false;
    button.textContent = config.label;
    button.dataset.action = config.action;
  }

  function showOverlay(type, info = {}) {
    const build = OVERLAYS[type];
    if (!build) {
      return;
    }
    const content = build(info);
    overlay.dataset.type = type;
    overlayTitle.textContent = content.title;
    overlayMessage.textContent = content.message;
    setButton(overlayPrimary, content.primary);
    setButton(overlaySecondary, content.secondary);

    if (!overlay.open) {
      // showModal은 바깥을 inert로 만들어 Tab이 오버레이 안에서만 돌게 한다
      if (typeof overlay.showModal === 'function') {
        overlay.showModal();
      } else {
        overlay.setAttribute('open', '');
      }
    }
    overlayPrimary.focus();
  }

  function hideOverlay() {
    if (overlay.open) {
      if (typeof overlay.close === 'function') {
        overlay.close();
      } else {
        overlay.removeAttribute('open');
      }
    }
    board.focus({ preventScroll: true });
  }

  // 같은 문구가 연달아 와도 스크린리더가 다시 읽도록 비웠다가 다음 프레임에 넣는다
  function announce(text) {
    cancelAnimationFrame(announceFrame);
    live.textContent = '';
    announceFrame = requestAnimationFrame(() => {
      live.textContent = text;
    });
  }

  return { render, setBest, showOverlay, hideOverlay, announce };
}
