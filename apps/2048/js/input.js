// 키보드·스와이프 입력을 방향 문자열로 바꿔 콜백에 넘긴다. 게임 규칙은 모른다.

const SWIPE_MIN_DISTANCE = 30;

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

// 한글 자판 상태에서는 event.key가 'ㅈ' 등으로 오므로 물리 키 위치(code)도 함께 본다
const CODE_DIRECTIONS = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

function directionFromKey(event) {
  const key = event.key && event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return KEY_DIRECTIONS[key] || CODE_DIRECTIONS[event.code] || null;
}

export function bindInput({ board, onMove, isBlocked = () => false }) {
  let start = null;

  function handleKeydown(event) {
    // 브라우저 단축키(Ctrl/Cmd/Alt 조합)는 가로채지 않는다
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const direction = directionFromKey(event);
    if (!direction) {
      return;
    }
    // 막힌 동안에도 게임 키는 페이지 스크롤을 막는다(오버레이가 열리면 바깥은 inert라 dialog 버튼 조작과 무관)
    event.preventDefault();
    if (!isBlocked()) {
      onMove(direction);
    }
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    // 손가락이 보드 밖으로 나가도 pointerup을 받기 위해
    try {
      board.setPointerCapture(event.pointerId);
    } catch {
      // 캡처를 못 해도 보드 안에서 끝나는 스와이프는 그대로 동작한다
    }
  }

  function handlePointerUp(event) {
    if (!start || event.pointerId !== start.id) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_DISTANCE || isBlocked()) {
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      onMove(dx > 0 ? 'right' : 'left');
    } else {
      onMove(dy > 0 ? 'down' : 'up');
    }
  }

  function handlePointerCancel(event) {
    if (start && event.pointerId === start.id) {
      start = null;
    }
  }

  document.addEventListener('keydown', handleKeydown);
  board.addEventListener('pointerdown', handlePointerDown);
  board.addEventListener('pointerup', handlePointerUp);
  board.addEventListener('pointercancel', handlePointerCancel);

  return function unbind() {
    document.removeEventListener('keydown', handleKeydown);
    board.removeEventListener('pointerdown', handlePointerDown);
    board.removeEventListener('pointerup', handlePointerUp);
    board.removeEventListener('pointercancel', handlePointerCancel);
  };
}
