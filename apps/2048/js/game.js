// 2048 순수 게임 로직. DOM·localStorage에 접근하지 않고, 입력 상태를 바꾸지 않은 채 새 상태를 돌려준다.

export const SIZE = 4;
export const WIN_VALUE = 2048;
export const DIRECTIONS = ['up', 'down', 'left', 'right'];

const CELL_COUNT = SIZE * SIZE;
const SAVE_VERSION = 1;
// 4×4 보드에서 이론상 나올 수 있는 최댓값(2^17)보다 큰 값은 깨진 저장값으로 본다
const MAX_TILE_VALUE = 2 ** 17;

function toRow(index) {
  return Math.floor(index / SIZE);
}

function toCol(index) {
  return index % SIZE;
}

// 한 줄을 "이동 방향 쪽 끝부터" 읽은 칸 번호 목록. 오른쪽·아래는 줄을 뒤집어 읽는 것과 같다.
function lineIndices(direction, line) {
  const indices = [];
  for (let pos = 0; pos < SIZE; pos += 1) {
    const step = direction === 'right' || direction === 'down' ? SIZE - 1 - pos : pos;
    if (direction === 'left' || direction === 'right') {
      indices.push(line * SIZE + step);
    } else {
      indices.push(step * SIZE + line);
    }
  }
  return indices;
}

// 줄 하나를 이동 방향 쪽으로 모으고 합친다. 합쳐서 생긴 타일은 같은 이동에서 다시 합쳐지지 않는다.
function collapse(line) {
  const items = line.filter(Boolean);
  const cells = [];
  let gained = 0;

  for (let i = 0; i < items.length; i += 1) {
    const current = items[i];
    const next = items[i + 1];
    if (next && next.value === current.value) {
      const value = current.value * 2;
      cells.push({ value, sources: [current, next] });
      gained += value;
      i += 1;
    } else {
      cells.push({ value: current.value, sources: [current] });
    }
  }

  while (cells.length < line.length) {
    cells.push(null);
  }
  return { cells, gained };
}

// 검증용: 값 배열 한 줄(이동 방향 쪽이 앞)을 처리한다. 빈칸은 null 또는 0.
// 예) slideLine([2, 2, 4, null]) → { values: [4, 4, null, null], gained: 4 }
export function slideLine(values) {
  const { cells, gained } = collapse(values.map((value) => (value ? { value } : null)));
  return { values: cells.map((cell) => (cell ? cell.value : null)), gained };
}

function emptyIndices(board) {
  const result = [];
  board.forEach((tile, index) => {
    if (!tile) {
      result.push(index);
    }
  });
  return result;
}

// 빈칸 중 균등 무작위 위치에 2(90%) 또는 4(10%) 타일을 놓는다. board는 호출한 쪽이 만든 새 배열이다.
function spawnTile(board, id, rng) {
  const empties = emptyIndices(board);
  if (empties.length === 0) {
    return null;
  }
  // rng가 1을 돌려주는 경우에도 범위를 벗어나지 않게 한다
  const pick = Math.min(Math.floor(rng() * empties.length), empties.length - 1);
  const index = empties[pick];
  const value = rng() < 0.9 ? 2 : 4;
  const tile = { id, value, row: toRow(index), col: toCol(index), isNew: true };
  board[index] = tile;
  return tile;
}

export function createGame({ rng = Math.random } = {}) {
  const board = new Array(CELL_COUNT).fill(null);
  let nextId = 1;
  for (let i = 0; i < 2; i += 1) {
    spawnTile(board, nextId, rng);
    nextId += 1;
  }
  return { board, score: 0, won: false, keepPlaying: false, over: false, nextId };
}

export function hasWon(state) {
  return state.board.some((tile) => tile && tile.value >= WIN_VALUE);
}

export function canMove(state) {
  const { board } = state;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const tile = board[index];
    if (!tile) {
      return true;
    }
    const col = toCol(index);
    const right = col < SIZE - 1 ? board[index + 1] : null;
    const below = index + SIZE < CELL_COUNT ? board[index + SIZE] : null;
    if ((right && right.value === tile.value) || (below && below.value === tile.value)) {
      return true;
    }
  }
  return false;
}

export function move(state, direction, { rng = Math.random } = {}) {
  const unchanged = { state, moved: false, scoreGained: 0, mergedValues: [], spawned: null };
  if (!DIRECTIONS.includes(direction) || state.over) {
    return unchanged;
  }

  const board = new Array(CELL_COUNT).fill(null);
  const mergedValues = [];
  let nextId = state.nextId;
  let scoreGained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line += 1) {
    const indices = lineIndices(direction, line);
    const { cells, gained } = collapse(indices.map((index) => state.board[index]));
    scoreGained += gained;

    cells.forEach((cell, pos) => {
      if (!cell) {
        return;
      }
      const index = indices[pos];
      const row = toRow(index);
      const col = toCol(index);

      if (cell.sources.length === 2) {
        const [first, second] = cell.sources;
        board[index] = { id: nextId, value: cell.value, row, col, mergedFrom: [first.id, second.id] };
        nextId += 1;
        mergedValues.push(cell.value);
        moved = true;
      } else {
        const source = cell.sources[0];
        if (source.row !== row || source.col !== col) {
          moved = true;
        }
        // 이전 이동의 isNew·mergedFrom 표시는 떼어 낸다(같은 id면 화면에서 같은 요소를 옮긴다)
        board[index] = { id: source.id, value: source.value, row, col };
      }
    });
  }

  if (!moved) {
    return unchanged;
  }

  const spawned = spawnTile(board, nextId, rng);
  if (spawned) {
    nextId += 1;
  }

  const next = {
    board,
    score: state.score + scoreGained,
    won: state.won,
    keepPlaying: state.keepPlaying,
    over: false,
    nextId,
  };
  next.won = state.won || hasWon(next);
  next.over = !canMove(next);

  return { state: next, moved: true, scoreGained, mergedValues, spawned };
}

export function continueGame(state) {
  return { ...state, keepPlaying: true };
}

// 저장용 단순 객체. id는 화면 애니메이션용이라 저장하지 않고 불러올 때 다시 매긴다.
export function serialize(state) {
  return {
    version: SAVE_VERSION,
    cells: state.board.map((tile) => (tile ? tile.value : 0)),
    score: state.score,
    won: state.won,
    keepPlaying: state.keepPlaying,
  };
}

function isValidTileValue(value) {
  // 2의 거듭제곱(2 이상)만 허용한다
  return Number.isInteger(value) && value >= 2 && value <= MAX_TILE_VALUE && (value & (value - 1)) === 0;
}

// 형식이 맞지 않으면 null을 돌려준다(호출한 쪽이 새 게임으로 시작).
export function deserialize(obj) {
  if (!obj || typeof obj !== 'object' || obj.version !== SAVE_VERSION) {
    return null;
  }
  const { cells, score, won, keepPlaying } = obj;
  if (!Array.isArray(cells) || cells.length !== CELL_COUNT) {
    return null;
  }
  if (!Number.isSafeInteger(score) || score < 0) {
    return null;
  }
  if (typeof won !== 'boolean' || typeof keepPlaying !== 'boolean') {
    return null;
  }
  if (!cells.every((value) => value === 0 || isValidTileValue(value))) {
    return null;
  }
  if (cells.every((value) => value === 0)) {
    return null;
  }

  let nextId = 1;
  const board = cells.map((value, index) => {
    if (value === 0) {
      return null;
    }
    const tile = { id: nextId, value, row: toRow(index), col: toCol(index) };
    nextId += 1;
    return tile;
  });

  const state = { board, score, won, keepPlaying, over: false, nextId };
  // 2048 타일이 있는데 won이 false면 승리 안내가 영영 뜨지 않으므로 보정한다
  state.won = won || hasWon(state);
  state.keepPlaying = state.won && keepPlaying;
  state.over = !canMove(state);
  return state;
}
