// Board rendering and game controller
const Board = (() => {
  const GRID = 5, MARGIN = 50, CELL = 90;
  const BOARD_SIZE = MARGIN * 2 + CELL * (GRID - 1);
  const PIECE_R = CELL * 0.38;

  let canvas, ctx, game, aiEngine = null, aiColor = null;
  let selected = null;
  let claimTimer = null, claimTimeLeft = 0;
  let showHints = true;
  let lastPlaced = null; // highlight last move

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = canvas.height = BOARD_SIZE;
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', onClick);
    setAI('greedy');
  }

  function newGame() {
    clearTimer();
    selected = null;
    lastPlaced = null;
    game = Game.create();
    render();
    updateStatus();
  }

  function setAI(level) {
    aiEngine = level ? AI.get(level) : null;
    aiColor = aiEngine ? 'W' : null;
    newGame();
  }

  function setHints(on) { showHints = on; render(); }

  function toBoard(px, py) {
    const r = Math.round((py - MARGIN) / CELL);
    const c = Math.round((px - MARGIN) / CELL);
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
    const dx = px - (MARGIN + c * CELL), dy = py - (MARGIN + r * CELL);
    if (Math.sqrt(dx * dx + dy * dy) > CELL * 0.45) return null;
    return { r, c };
  }

  function toPixel(r, c) {
    return { x: MARGIN + c * CELL, y: MARGIN + r * CELL };
  }

  // ===================== Rendering =====================
  function render() {
    ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
    drawBoard();
    drawLastMove();
    drawFormationLines();
    drawPieces();
    drawSelection();
    if (game.state === Game.STATE_WAIT_PINCH_SELECT) drawPinchTargets();
  }

  function drawBoard() {
    // Wood texture background
    const grad = ctx.createLinearGradient(0, 0, BOARD_SIZE, BOARD_SIZE);
    grad.addColorStop(0, '#E8C97A');
    grad.addColorStop(0.5, '#D4A843');
    grad.addColorStop(1, '#C49A3C');
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(ctx, 0, 0, BOARD_SIZE, BOARD_SIZE, 12);
    ctx.fill();

    // Inner board area with subtle shadow
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    roundRect(ctx, MARGIN - 20, MARGIN - 20, CELL * 4 + 40, CELL * 4 + 40, 6);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = '#6B5B3A';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < GRID; i++) {
      const p = MARGIN + i * CELL;
      ctx.beginPath(); ctx.moveTo(MARGIN, p); ctx.lineTo(MARGIN + CELL * 4, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, MARGIN); ctx.lineTo(p, MARGIN + CELL * 4); ctx.stroke();
    }

    // Intersection dots
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        const { x, y } = toPixel(r, c);
        ctx.fillStyle = '#6B5B3A';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Coordinate labels
    ctx.fillStyle = '#8B7355';
    ctx.font = '12px "SF Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < GRID; i++) {
      ctx.fillText(String.fromCharCode(65 + i), MARGIN + i * CELL, MARGIN - 30);
      ctx.fillText(String(i + 1), MARGIN - 30, MARGIN + i * CELL);
    }
  }

  function drawLastMove() {
    if (!lastPlaced) return;
    const { x, y } = toPixel(lastPlaced.r, lastPlaced.c);
    ctx.fillStyle = 'rgba(255, 180, 0, 0.25)';
    ctx.beginPath(); ctx.arc(x, y, PIECE_R + 6, 0, Math.PI * 2); ctx.fill();
  }

  function drawPieces() {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = game.board[r][c];
        if (!cell) continue;
        const { x, y } = toPixel(r, c);
        const isDead = cell[0] === 'D';
        const base = isDead ? cell[1] : cell;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.arc(x + 2, y + 3, PIECE_R, 0, Math.PI * 2); ctx.fill();

        // Piece body with gradient
        const grad = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, PIECE_R);
        if (base === 'B') {
          grad.addColorStop(0, isDead ? '#888' : '#555');
          grad.addColorStop(1, isDead ? '#555' : '#111');
        } else {
          grad.addColorStop(0, isDead ? '#ddd' : '#fff');
          grad.addColorStop(1, isDead ? '#aaa' : '#ccc');
        }
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, PIECE_R, 0, Math.PI * 2); ctx.fill();

        // Rim
        ctx.strokeStyle = isDead ? 'rgba(231,76,60,0.6)' : (base === 'B' ? '#000' : '#999');
        ctx.lineWidth = isDead ? 2 : 1.2;
        ctx.stroke();

        // Shine highlight
        if (!isDead) {
          ctx.fillStyle = 'rgba(255,255,255,' + (base === 'B' ? '0.15' : '0.5') + ')';
          ctx.beginPath(); ctx.arc(x - 8, y - 10, PIECE_R * 0.35, 0, Math.PI * 2); ctx.fill();
        }

        // Dead X mark
        if (isDead) {
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          const s = 12;
          ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
          ctx.lineCap = 'butt';
        }
      }
    }
  }

  function drawFormationLines() {
    if (!showHints) return;
    // Existing formations (subtle)
    for (const color of ['B', 'W']) {
      for (const f of game.formations[color]) {
        drawFormationLine(f, color === 'B' ? 'rgba(50,50,50,0.25)' : 'rgba(200,200,200,0.3)', 2.5, [6, 4]);
      }
    }
    // New formations (bold red glow)
    for (const f of game.newFormations) {
      drawFormationLine(f, 'rgba(231,76,60,0.4)', 6, []);
      drawFormationLine(f, '#e74c3c', 2.5, []);
    }
  }

  function drawFormationLine(f, color, width, dash) {
    const sorted = [...f.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const s = toPixel(sorted[0][0], sorted[0][1]);
    ctx.moveTo(s.x, s.y);
    for (let i = 1; i < sorted.length; i++) {
      const p = toPixel(sorted[i][0], sorted[i][1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }

  function drawSelection() {
    if (!selected) return;
    const { x, y } = toPixel(selected.r, selected.c);
    // Glow ring
    ctx.strokeStyle = 'rgba(46,204,113,0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(x, y, PIECE_R + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, PIECE_R + 5, 0, Math.PI * 2); ctx.stroke();

    // Valid move targets
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = selected.r + dr, nc = selected.c + dc;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && game.board[nr][nc] === null) {
        const p = toPixel(nr, nc);
        ctx.fillStyle = 'rgba(46,204,113,0.3)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(46,204,113,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  function drawPinchTargets() {
    const opp = game.turn === 'B' ? 'W' : 'B';
    for (const [r, c] of Formation.pinchTargets(game.board, opp)) {
      const { x, y } = toPixel(r, c);
      ctx.strokeStyle = 'rgba(231,76,60,0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, PIECE_R + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(x, y, PIECE_R + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===================== Click handling =====================
  function onClick(e) {
    if (game.phase === Game.PHASE_OVER) return;
    if (aiEngine && game.turn === aiColor && game.state !== Game.STATE_WAIT_PINCH_CLAIM) return;

    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const pos = toBoard((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale);
    if (!pos) return;
    const { r, c } = pos;

    if (game.state === Game.STATE_WAIT_ACTION) {
      if (game.phase === Game.PHASE_PLACE) {
        const result = Game.place(game, r, c);
        if (result) { lastPlaced = { r, c }; afterAction(result); }
      } else {
        if (selected) {
          if (game.board[r][c] === game.turn) { selected = { r, c }; render(); return; }
          const result = Game.move(game, selected.r, selected.c, r, c);
          if (result) { lastPlaced = { r: r, c: c }; selected = null; afterAction(result); }
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
    updateStatus();
    if (result.newFormations && result.newFormations.length > 0) {
      startClaimTimer();
    } else {
      scheduleAI();
    }
  }

  // ===================== 5-second claim timer =====================
  function startClaimTimer() {
    // IMPORTANT: clear any existing timer FIRST, then set time
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
    claimTimeLeft = 5000;
    updateStatus();
    updateTimerBar();
    const tick = 50;
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
    if (result && result.valid && aiEngine && game.turn === aiColor) {
      setTimeout(doAIPinch, 300);
    }
  }

  // ===================== AI =====================
  function scheduleAI() {
    if (!aiEngine || game.turn !== aiColor || game.phase === Game.PHASE_OVER) return;
    setTimeout(doAITurn, 600);
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
      if (m) { result = Game.place(game, m.r, m.c); lastPlaced = { r: m.r, c: m.c }; }
    } else {
      const m = aiEngine.chooseMove(game);
      if (m) { result = Game.move(game, m.fr, m.fc, m.tr, m.tc); lastPlaced = { r: m.tr, c: m.tc }; }
    }

    if (result) {
      render();
      if (result.newFormations && result.newFormations.length > 0 && AI.shouldClaimPinch(game)) {
        startClaimTimer();
        setTimeout(() => {
          if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
          claimTimeLeft = 0; updateTimerBar();
          Game.claimPinch(game);
          render(); updateStatus();
          setTimeout(doAIPinch, 300);
        }, 600);
        return;
      }
      updateStatus();
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

  // ===================== UI updates =====================
  function updateStatus() {
    const el = document.getElementById('status');
    if (!el) return;

    const phaseNames = { [Game.PHASE_PLACE]: '下子阶段', [Game.PHASE_MOVE]: '走子阶段', [Game.PHASE_OVER]: '游戏结束' };
    const turnIcon = game.turn === 'B' ? '●' : '○';
    const turnName = game.turn === 'B' ? '黑方' : '白方';

    let msg = '';
    switch (game.state) {
      case Game.STATE_WAIT_ACTION:
        msg = game.phase === Game.PHASE_PLACE ? '请落子' : '选择棋子移动';
        break;
      case Game.STATE_WAIT_PINCH_CLAIM: msg = '发现成形！请点击掐子按钮'; break;
      case Game.STATE_WAIT_PINCH_SELECT: msg = `请选择要掐的棋子 (${game.pinchesRemaining}次)`; break;
      case Game.STATE_WAIT_SACRIFICE: msg = '无路可走，请献祭一子'; break;
      default: if (game.winner) msg = `${game.winner === 'B' ? '黑方' : '白方'}获胜！`; break;
    }

    el.innerHTML = `<span class="phase-tag">${phaseNames[game.phase]}</span> ` +
      `<span class="turn-indicator ${game.turn === 'B' ? 'turn-black' : 'turn-white'}">${turnIcon} ${turnName}</span> ` +
      `<span class="status-msg">${msg}</span>`;

    // Claim button - visible during claim window AND pinch selection
    const btn = document.getElementById('btn-claim');
    if (btn) {
      const showClaim = game.state === Game.STATE_WAIT_PINCH_CLAIM;
      const showSelect = game.state === Game.STATE_WAIT_PINCH_SELECT;
      const show = showClaim || showSelect;
      btn.style.display = show ? 'flex' : 'none';
      btn.classList.toggle('active', show);
      const txt = btn.querySelector('.claim-text');
      if (txt) txt.textContent = showSelect ? `🎯 请选择要掐的棋子 (${game.pinchesRemaining})` : '✋ 我要掐子！';
    }

    // Piece counts
    const bEl = document.getElementById('count-b');
    const wEl = document.getElementById('count-w');
    if (bEl) bEl.textContent = Game.pieceCount(game, 'B');
    if (wEl) wEl.textContent = Game.pieceCount(game, 'W');

    // Move count
    const moveEl = document.getElementById('move-count');
    if (moveEl) moveEl.textContent = game.phase === Game.PHASE_PLACE ? `${game.placedCount}/25` : '—';
  }

  function updateTimerBar() {
    const fill = document.getElementById('timer-fill');
    if (!fill) return;
    fill.style.width = Math.max(0, claimTimeLeft / 5000 * 100) + '%';
  }

  function showWinner() { render(); updateStatus(); }

  function undoMove() {
    clearTimer();
    selected = null;
    lastPlaced = null;
    if (Game.undo(game)) {
      if (aiEngine) Game.undo(game);
      render(); updateStatus();
    }
  }

  return { init, newGame, setAI, setHints, claimPinch, undoMove, render };
})();
