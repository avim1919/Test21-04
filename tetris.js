(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const HIDDEN_ROWS = 2;
  const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

  const COLORS = {
    I: '#22d3ee',
    O: '#fbbf24',
    T: '#a855f7',
    S: '#22c55e',
    Z: '#ef4444',
    J: '#3b82f6',
    L: '#f97316',
    GHOST: 'rgba(255,255,255,0.15)',
    GRID: 'rgba(255,255,255,0.04)',
  };

  // Tetromino shapes at spawn orientation (4x4 for I and O consistency, 3x3 for others).
  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  };

  const PIECES = Object.keys(SHAPES);

  // Scoring per lines cleared (single/double/triple/tetris).
  const LINE_SCORES = [0, 100, 300, 500, 800];

  // Gravity per level (ms per cell).
  function gravityFor(level) {
    // Tuned curve: level 1 ~800ms, level 10 ~80ms, level 20 ~30ms.
    const base = 800 * Math.pow(0.82, level - 1);
    return Math.max(40, base);
  }

  // Canvas setup.
  const boardCanvas = document.getElementById('board');
  const ctx = boardCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold');
  const hctx = holdCanvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');

  // Scale canvas for high-DPI displays.
  function fitCanvas(canvas, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  function resizeBoard() {
    const cssW = boardCanvas.clientWidth || 300;
    const cssH = boardCanvas.clientHeight || 600;
    fitCanvas(boardCanvas, cssW, cssH);
    render();
  }

  window.addEventListener('resize', resizeBoard);

  // Create an empty grid.
  function createGrid() {
    const g = [];
    for (let y = 0; y < TOTAL_ROWS; y++) {
      g.push(new Array(COLS).fill(null));
    }
    return g;
  }

  // Rotate a matrix clockwise.
  function rotateCW(m) {
    const n = m.length;
    const r = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        r[x][n - 1 - y] = m[y][x];
      }
    }
    return r;
  }

  function rotateCCW(m) {
    return rotateCW(rotateCW(rotateCW(m)));
  }

  function cloneMatrix(m) {
    return m.map((row) => row.slice());
  }

  // Simple wall-kick offsets (not full SRS, but playable).
  const KICKS = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-2, 0],
    [2, 0],
    [0, 1],
  ];

  // 7-bag randomizer for fair piece distribution.
  function createBag() {
    const bag = PIECES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  const state = {
    grid: createGrid(),
    current: null,
    next: null,
    hold: null,
    holdUsed: false,
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    best: Number(localStorage.getItem('tetris_best') || 0),
    running: false,
    paused: false,
    gameOver: false,
    dropMs: gravityFor(1),
    lastDrop: 0,
    softDrop: false,
  };

  bestEl.textContent = state.best;

  function nextFromBag() {
    if (state.bag.length === 0) state.bag = createBag();
    return state.bag.shift();
  }

  function spawn() {
    const type = state.next || nextFromBag();
    state.next = nextFromBag();
    const shape = cloneMatrix(SHAPES[type]);
    const piece = {
      type,
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      // Spawn slightly above visible area.
      y: type === 'I' ? HIDDEN_ROWS - 1 : HIDDEN_ROWS - 2,
    };
    state.current = piece;
    state.holdUsed = false;
    if (collides(piece, 0, 0, piece.shape)) {
      endGame();
    }
  }

  function collides(piece, dx, dy, shape) {
    const s = shape || piece.shape;
    for (let y = 0; y < s.length; y++) {
      for (let x = 0; x < s[y].length; x++) {
        if (!s[y][x]) continue;
        const nx = piece.x + x + dx;
        const ny = piece.y + y + dy;
        if (nx < 0 || nx >= COLS) return true;
        if (ny >= TOTAL_ROWS) return true;
        if (ny >= 0 && state.grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge() {
    const p = state.current;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (!p.shape[y][x]) continue;
        const gy = p.y + y;
        const gx = p.x + x;
        if (gy >= 0 && gy < TOTAL_ROWS) state.grid[gy][gx] = p.type;
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = TOTAL_ROWS - 1; y >= 0; y--) {
      if (state.grid[y].every((c) => c)) {
        state.grid.splice(y, 1);
        state.grid.unshift(new Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      state.lines += cleared;
      state.score += LINE_SCORES[cleared] * state.level;
      const newLevel = Math.floor(state.lines / 10) + 1;
      if (newLevel !== state.level) {
        state.level = newLevel;
        state.dropMs = gravityFor(state.level);
      }
      updateStats();
    }
  }

  function updateStats() {
    scoreEl.textContent = state.score;
    linesEl.textContent = state.lines;
    levelEl.textContent = state.level;
    if (state.score > state.best) {
      state.best = state.score;
      bestEl.textContent = state.best;
      localStorage.setItem('tetris_best', String(state.best));
    }
  }

  function move(dx, dy) {
    if (!state.current || !state.running || state.paused) return false;
    if (!collides(state.current, dx, dy)) {
      state.current.x += dx;
      state.current.y += dy;
      return true;
    }
    return false;
  }

  function rotate(dir) {
    if (!state.current || !state.running || state.paused) return;
    if (state.current.type === 'O') return;
    const rotated = dir > 0 ? rotateCW(state.current.shape) : rotateCCW(state.current.shape);
    for (const [kx, ky] of KICKS) {
      if (!collides(state.current, kx, ky, rotated)) {
        state.current.shape = rotated;
        state.current.x += kx;
        state.current.y += ky;
        return;
      }
    }
  }

  function hardDrop() {
    if (!state.current || !state.running || state.paused) return;
    let dropped = 0;
    while (!collides(state.current, 0, 1)) {
      state.current.y++;
      dropped++;
    }
    state.score += dropped * 2;
    lock();
  }

  function softDropStep() {
    if (!move(0, 1)) {
      lock();
    } else {
      state.score += 1;
      updateStats();
    }
  }

  function lock() {
    merge();
    clearLines();
    updateStats();
    spawn();
  }

  function doHold() {
    if (!state.running || state.paused || state.holdUsed) return;
    const cur = state.current.type;
    if (state.hold) {
      const prev = state.hold;
      state.hold = cur;
      const shape = cloneMatrix(SHAPES[prev]);
      state.current = {
        type: prev,
        shape,
        x: Math.floor((COLS - shape[0].length) / 2),
        y: prev === 'I' ? HIDDEN_ROWS - 1 : HIDDEN_ROWS - 2,
      };
    } else {
      state.hold = cur;
      spawn();
    }
    state.holdUsed = true;
  }

  function ghostY() {
    if (!state.current) return 0;
    let y = 0;
    while (!collides(state.current, 0, y + 1)) y++;
    return y;
  }

  // Rendering.
  function cellSize() {
    return boardCanvas.clientWidth / COLS;
  }

  function drawCell(c, x, y, color, size, alpha = 1) {
    const px = x * size;
    const py = y * size;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(px + 1, py + 1, size - 2, size - 2);
    // Inner highlight.
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(px + 2, py + 2, size - 4, Math.max(2, size * 0.18));
    // Bottom shadow.
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(px + 2, py + size - Math.max(2, size * 0.18) - 2, size - 4, Math.max(2, size * 0.18));
    c.restore();
  }

  function drawGrid() {
    const size = cellSize();
    ctx.clearRect(0, 0, boardCanvas.clientWidth, boardCanvas.clientHeight);
    // Subtle grid lines.
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * size, 0);
      ctx.lineTo(x * size, ROWS * size);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * size);
      ctx.lineTo(COLS * size, y * size);
      ctx.stroke();
    }
  }

  function drawBoard() {
    const size = cellSize();
    for (let y = HIDDEN_ROWS; y < TOTAL_ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = state.grid[y][x];
        if (cell) {
          drawCell(ctx, x, y - HIDDEN_ROWS, COLORS[cell], size);
        }
      }
    }
  }

  function drawPiece(piece, targetCtx, cell, offsetX = 0, offsetY = 0, alpha = 1) {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (!piece.shape[y][x]) continue;
        drawCell(targetCtx, piece.x + x + offsetX, piece.y + y + offsetY - HIDDEN_ROWS, COLORS[piece.type], cell, alpha);
      }
    }
  }

  function drawGhost() {
    if (!state.current) return;
    const size = cellSize();
    const dy = ghostY();
    for (let y = 0; y < state.current.shape.length; y++) {
      for (let x = 0; x < state.current.shape[y].length; x++) {
        if (!state.current.shape[y][x]) continue;
        const gx = state.current.x + x;
        const gy = state.current.y + y + dy - HIDDEN_ROWS;
        if (gy < 0) continue;
        ctx.save();
        ctx.strokeStyle = COLORS[state.current.type];
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.strokeRect(gx * size + 2, gy * size + 2, size - 4, size - 4);
        ctx.restore();
      }
    }
  }

  function drawPreview(type, targetCanvas, targetCtx) {
    const cssW = targetCanvas.clientWidth || 120;
    const cssH = targetCanvas.clientHeight || 120;
    fitCanvas(targetCanvas, cssW, cssH);
    const c = targetCanvas.getContext('2d');
    c.clearRect(0, 0, cssW, cssH);
    if (!type) return;
    const shape = SHAPES[type];
    const size = Math.floor(Math.min(cssW, cssH) / 5);
    const w = shape[0].length * size;
    const h = shape.length * size;
    const ox = (cssW - w) / 2;
    const oy = (cssH - h) / 2;
    c.save();
    c.translate(ox, oy);
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        drawCell(c, x, y, COLORS[type], size);
      }
    }
    c.restore();
  }

  function render() {
    drawGrid();
    drawBoard();
    if (state.current && state.running) {
      drawGhost();
      const size = cellSize();
      drawPiece(state.current, ctx, size);
    }
    drawPreview(state.next, nextCanvas, nctx);
    drawPreview(state.hold, holdCanvas, hctx);
  }

  // Game loop.
  let rafId = null;
  function loop(ts) {
    if (!state.running || state.paused || state.gameOver) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    if (!state.lastDrop) state.lastDrop = ts;
    const interval = state.softDrop ? Math.min(60, state.dropMs) : state.dropMs;
    if (ts - state.lastDrop >= interval) {
      if (state.softDrop) {
        softDropStep();
      } else {
        if (!move(0, 1)) lock();
      }
      state.lastDrop = ts;
    }
    render();
    rafId = requestAnimationFrame(loop);
  }

  function showOverlay(title, text, btnLabel = 'Start') {
    overlayTitle.textContent = title;
    overlayText.innerHTML = text;
    startBtn.textContent = btnLabel;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function startGame() {
    state.grid = createGrid();
    state.current = null;
    state.next = null;
    state.hold = null;
    state.holdUsed = false;
    state.bag = [];
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.dropMs = gravityFor(1);
    state.lastDrop = 0;
    state.running = true;
    state.paused = false;
    state.gameOver = false;
    updateStats();
    spawn();
    hideOverlay();
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
    if (state.paused) {
      showOverlay('Paused', 'Press <kbd>P</kbd> to resume', 'Resume');
    } else {
      hideOverlay();
      state.lastDrop = 0;
    }
  }

  function endGame() {
    state.running = false;
    state.gameOver = true;
    updateStats();
    showOverlay('Game Over', `You scored <strong>${state.score}</strong> · Lines cleared: <strong>${state.lines}</strong>`, 'Play again');
  }

  // Input handling.
  const KEY_REPEAT_DELAY = 140;
  const KEY_REPEAT_RATE = 40;
  const heldKeys = new Map();

  function handleAction(action) {
    switch (action) {
      case 'left': move(-1, 0); break;
      case 'right': move(1, 0); break;
      case 'down': softDropStep(); break;
      case 'rotate': rotate(1); break;
      case 'rotate-ccw': rotate(-1); break;
      case 'drop': hardDrop(); break;
      case 'hold': doHold(); break;
      case 'pause': togglePause(); break;
      case 'start':
        if (!state.running || state.gameOver) startGame();
        else togglePause();
        break;
    }
    render();
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    switch (e.key) {
      case 'ArrowLeft':
        handleAction('left');
        heldKeys.set('left', { last: performance.now(), started: performance.now() });
        break;
      case 'ArrowRight':
        handleAction('right');
        heldKeys.set('right', { last: performance.now(), started: performance.now() });
        break;
      case 'ArrowDown':
        state.softDrop = true;
        break;
      case 'ArrowUp':
      case 'x':
      case 'X':
        handleAction('rotate');
        break;
      case 'z':
      case 'Z':
        handleAction('rotate-ccw');
        break;
      case ' ':
        if (!state.running || state.gameOver) {
          startGame();
        } else {
          handleAction('drop');
        }
        break;
      case 'c':
      case 'C':
        handleAction('hold');
        break;
      case 'p':
      case 'P':
        handleAction('pause');
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowLeft': heldKeys.delete('left'); break;
      case 'ArrowRight': heldKeys.delete('right'); break;
      case 'ArrowDown': state.softDrop = false; break;
    }
  });

  // Auto-repeat for held movement keys.
  setInterval(() => {
    const now = performance.now();
    for (const [k, info] of heldKeys) {
      if (now - info.started < KEY_REPEAT_DELAY) continue;
      if (now - info.last >= KEY_REPEAT_RATE) {
        handleAction(k);
        info.last = now;
      }
    }
  }, 16);

  // Mobile button controls.
  document.querySelectorAll('.mbtn').forEach((btn) => {
    const action = btn.dataset.action;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!state.running || state.gameOver) {
        if (action === 'drop') startGame();
        return;
      }
      handleAction(action);
    });
  });

  startBtn.addEventListener('click', () => {
    if (state.paused) {
      togglePause();
    } else {
      startGame();
    }
  });

  // Initial render.
  requestAnimationFrame(() => {
    resizeBoard();
    drawPreview(null, nextCanvas, nctx);
    drawPreview(null, holdCanvas, hctx);
    render();
  });
})();
