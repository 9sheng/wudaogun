// Board rendering and game controller
const Board = (() => {
  const GRID = 5, MARGIN = 40, CELL = 80;
  const BOARD_SIZE = MARGIN * 2 + CELL * (GRID - 1);
  const COLORS = { B: '#222', W: '#fff', DB: '#888', DW: '#ccc', grid: '#8B7355', bg: '#DEB887', highlight: '#e74c3c' };

  let canvas, ctx, game, aiEngine = null, aiColor = null;
  let selected = null; // {r,c} for move phase piece selection
  let claimTimer = null, claimTimeLeft = 0;
  let showHints = true;
  let animFrame = null, pulsePhase = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = canvas.height = BOARD_SIZE;
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', onClick);
    newGame();
  }

  function newGame() {
    clearTimer();
    selected = null;
    game = Game.create();
    render();
    updateStatus();
  }

  function setAI(level) {
    aiEngine = level ? AI.get(level) : null;
    aiColor = aiEngine ? 'W' : null;
  }

  function setHints(on) { showHints = on; render(); }

  // Coordinate conversion
  function toBoard(px, py) {
    const r = Math.round((py - MARGIN) / CELL);
    const c = Math.round((px - MARGIN) / CELL);
    const dx = px - (MARGIN + c * CELL), dy = py - (MARGIN + r * CELL);
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
    if (Math.sqrt(dx*dx + dy*dy) > CELL * 0.45) return null;
    return { r, c };
  }

  function toPixel(r, c) {
    return { x: MARGIN + c * CELL, y: MARGIN + r * CELL };
  }

  // --- Rendering ---
  function render() {
    ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
    drawBoard();
    drawFormationLines();
    drawPieces();
    drawSelection();
    if (game.state === Game.STATE_WAIT_PINCH_SELECT) drawPinchTargets();
  }

  function drawBoard() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < GRID; i++) {
      const p = MARGIN + i * CELL;
      ctx.beginPath(); ctx.moveTo(MARGIN, p); ctx.lineTo(MARGIN + CELL*4, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, MARGIN); ctx.lineTo(p, MARGIN + CELL*4); ctx.stroke();
    }
    // Draw intersection dots
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        const {x, y} = toPixel(r, c);
        ctx.fillStyle = COLORS.grid;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
      }
  }

  function drawPieces() {
    const R = CELL * 0.35;
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        const cell = game.board[r][c];
        if (!cell) continue;
        const {x, y} = toPixel(r, c);
        const isDead = cell[0] === 'D';
        const base = isDead ? cell[1] : cell;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2);
        ctx.fillStyle = COLORS[cell] || (base === 'B' ? COLORS.B : COLORS.W);
        ctx.fill();
        ctx.strokeStyle = isDead ? '#e74c3c' : '#555';
        ctx.lineWidth = isDead ? 2.5 : 1.5;
        ctx.stroke();
        if (isDead) {
          // X mark on dead pieces
          ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x-10, y-10); ctx.lineTo(x+10, y+10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x+10, y-10); ctx.lineTo(x-10, y+10); ctx.stroke();
        }
      }
  }

  function drawFormationLines() {
    if (!showHints) return;
    for (const color of ['B', 'W']) {
      const formations = game.formations[color];
      for (const f of formations) {
        ctx.strokeStyle = color === 'B' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        const sorted = [...f.cells].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
        ctx.beginPath();
        const s = toPixel(sorted[0][0], sorted[0][1]);
        ctx.moveTo(s.x, s.y);
        for (let i = 1; i < sorted.length; i++) {
          const p = toPixel(sorted[i][0], sorted[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Highlight new formations with solid red
    if (game.newFormations.length > 0 && showHints) {
      for (const f of game.newFormations) {
        ctx.strokeStyle = COLORS.highlight;
        ctx.lineWidth = 3;
        const sorted = [...f.cells].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
        ctx.beginPath();
        const s = toPixel(sorted[0][0], sorted[0][1]);
        ctx.moveTo(s.x, s.y);
        for (let i = 1; i < sorted.length; i++) {
          const p = toPixel(sorted[i][0], sorted[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }
  }

  function drawSelection() {
    if (!selected) return;
    const {x, y} = toPixel(selected.r, selected.c);
    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, CELL*0.4, 0, Math.PI*2); ctx.stroke();
    // Show valid move targets
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = selected.r+dr, nc = selected.c+dc;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && game.board[nr][nc] === null) {
        const p = toPixel(nr, nc);
        ctx.fillStyle = 'rgba(46,204,113,0.3)';
        ctx.beginPath(); ctx.arc(p.x, p.y, CELL*0.2, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  function drawPinchTargets() {
    const opp = game.turn === 'B' ? 'W' : 'B';
    const targets = Formation.pinchTargets(game.board, opp);
    for (const [r, c] of targets) {
      const {x, y} = toPixel(r, c);
      ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(x, y, CELL*0.42, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // --- Click handling ---
  function onClick(e) {
    if (game.phase === Game.PHASE_OVER) return;
    if (aiEngine && game.turn === aiColor && game.state !== Game.STATE_WAIT_PINCH_CLAIM) return;

    const rect = canvas.getBoundingClientRect();
    const pos = toBoard(e.clientX - rect.left, e.clientY - rect.top);
    if (!pos) return;

    const { r, c } = pos;

    if (game.state === Game.STATE_WAIT_ACTION) {
      if (game.phase === Game.PHASE_PLACE) {
        const result = Game.place(game, r, c);
        if (result) afterAction(result);
      } else {
        // Move phase: select then target
        if (selected) {
          if (game.board[r][c] === game.turn) {
            selected = { r, c }; render(); return;
          }
          const result = Game.move(game, selected.r, selected.c, r, c);
          if (result) { selected = null; afterAction(result); }
        } else if (game.board[r][c] === game.turn) {
          selected = { r, c }; render();
        }
      }
    } else if (game.state === Game.STATE_WAIT_PINCH_SELECT) {
      const result = Game.pinch(game, r, c);
      if (result) {
        render(); updateStatus();
        if (result.gameOver) return showWinner();
        if (!result.more) scheduleAI();
      }
    } else if (game.state === Game.STATE_WAIT_SACRIFICE) {
      const result = Game.sacrifice(game, r, c);
      if (result) {
        render(); updateStatus();
        if (result.gameOver) return showWinner();
        scheduleAI();
      }
    }
  }

  function afterAction(result) {
    render();
    if (result.newFormations && result.newFormations.length > 0) {
      startClaimTimer();
    } else {
      updateStatus();
      scheduleAI();
    }
  }

  // --- 5-second claim timer ---
  function startClaimTimer() {
    claimTimeLeft = 5000;
    updateStatus();
    const tick = 50;
    clearTimer();
    claimTimer = setInterval(() => {
      claimTimeLeft -= tick;
      updateTimerBar();
      if (claimTimeLeft <= 0) {
        clearTimer();
        Game.expireClaim(game);
        render(); updateStatus();
        scheduleAI();
      }
    }, tick);
  }

  function clearTimer() {
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
    claimTimeLeft = 0;
    updateTimerBar();
  }

  function claimPinch() {
    if (game.state !== Game.STATE_WAIT_PINCH_CLAIM) return;
    clearTimer();
    const result = Game.claimPinch(game);
    render(); updateStatus();
    if (result && !result.valid) scheduleAI();
    // If valid, wait for pinch target selection (or AI picks)
    if (result && result.valid && aiEngine && game.turn === aiColor) {
      setTimeout(doAIPinch, 300);
    }
  }

  // --- AI ---
  function scheduleAI() {
    if (!aiEngine || game.turn !== aiColor || game.phase === Game.PHASE_OVER) return;
    setTimeout(doAITurn, 400);
  }

  function doAITurn() {
    if (game.phase === Game.PHASE_OVER) return;

    if (game.state === Game.STATE_WAIT_SACRIFICE) {
      const t = aiEngine.chooseSacrifice(game);
      if (t) {
        const result = Game.sacrifice(game, t[0], t[1]);
        render(); updateStatus();
        if (result && result.gameOver) return showWinner();
        scheduleAI();
      }
      return;
    }

    if (game.state !== Game.STATE_WAIT_ACTION) return;

    let result;
    if (game.phase === Game.PHASE_PLACE) {
      const m = aiEngine.choosePlace(game);
      if (m) result = Game.place(game, m.r, m.c);
    } else {
      const m = aiEngine.chooseMove(game);
      if (m) result = Game.move(game, m.fr, m.fc, m.tr, m.tc);
    }

    if (result) {
      render();
      if (result.newFormations && result.newFormations.length > 0) {
        // AI always claims immediately
        if (AI.shouldClaimPinch(game)) {
          setTimeout(() => {
            clearTimer();
            Game.claimPinch(game);
            render(); updateStatus();
            setTimeout(doAIPinch, 300);
          }, 500);
          startClaimTimer(); // visual feedback
          return;
        }
      }
      updateStatus();
      // If it's still AI's turn (shouldn't be normally), continue
    }
  }

  function doAIPinch() {
    if (game.state !== Game.STATE_WAIT_PINCH_SELECT) return;
    const t = aiEngine.choosePinch(game);
    if (t) {
      const result = Game.pinch(game, t[0], t[1]);
      render(); updateStatus();
      if (result && result.gameOver) return showWinner();
      if (result && result.more) setTimeout(doAIPinch, 300);
    }
  }

  // --- UI updates ---
  function updateStatus() {
    const el = document.getElementById('status');
    if (!el) return;
    const phase = game.phase === Game.PHASE_PLACE ? '下子阶段' : game.phase === Game.PHASE_MOVE ? '走子阶段' : '游戏结束';
    const turn = game.turn === 'B' ? '⚫ 黑方' : '⚪ 白方';
    let stateText = '';
    if (game.state === Game.STATE_WAIT_ACTION) stateText = '请落子';
    else if (game.state === Game.STATE_WAIT_PINCH_CLAIM) stateText = '⏱ 窗口判定中...';
    else if (game.state === Game.STATE_WAIT_PINCH_SELECT) stateText = `🎯 请掐子 (剩余 ${game.pinchesRemaining})`;
    else if (game.state === Game.STATE_WAIT_SACRIFICE) stateText = '⚠️ 无路可走，请献祭一子';
    else if (game.phase === Game.PHASE_OVER) stateText = `🏆 ${game.winner === 'B' ? '黑方' : '白方'}获胜！`;

    if (game.phase === Game.PHASE_MOVE) {
      stateText += game.state === Game.STATE_WAIT_ACTION ? ' (点击己方棋子选中，再点击相邻空位移动)' : '';
    }
    el.textContent = `${phase} | ${turn} | ${stateText}`;

    // Claim button visibility
    const btn = document.getElementById('btn-claim');
    if (btn) btn.style.display = game.state === Game.STATE_WAIT_PINCH_CLAIM ? 'inline-block' : 'none';

    // Piece counts
    const countEl = document.getElementById('piece-count');
    if (countEl) {
      countEl.textContent = `⚫ ${Game.pieceCount(game, 'B')} | ⚪ ${Game.pieceCount(game, 'W')}`;
    }
  }

  function updateTimerBar() {
    const bar = document.getElementById('timer-bar');
    if (!bar) return;
    const pct = Math.max(0, claimTimeLeft / 5000 * 100);
    bar.style.width = pct + '%';
    bar.style.display = claimTimeLeft > 0 ? 'block' : 'none';
  }

  function showWinner() {
    render(); updateStatus();
  }

  function undoMove() {
    clearTimer();
    selected = null;
    if (Game.undo(game)) {
      // If playing AI, undo twice (undo AI move + player move)
      if (aiEngine) Game.undo(game);
      render(); updateStatus();
    }
  }

  return { init, newGame, setAI, setHints, claimPinch, undoMove, render };
})();
