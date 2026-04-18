// Board rendering and game controller
const Board = (() => {
  const GRID = 5, MARGIN = 50, CELL = 90;
  const BOARD_SIZE = MARGIN * 2 + CELL * (GRID - 1);
  const PIECE_R = CELL * 0.38;

  let canvas, ctx, game, aiEngine = null, aiColor = null;
  let selected = null;
  let claimTimer = null, claimTimeLeft = 0, claimTimeTotal = 10000;
  let showHints = true;
  let multiPinch = false;
  let soundOn = true;
  let firstPlayer = 'B';
  let lastPlaced = null;
  let pinchAnim = null; // {r, c, phase} for pinch animation
  let blindTimer = false; // true when showing blind-mode countdown (no formation)

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = canvas.height = BOARD_SIZE;
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchend', onTouch, { passive: false });
    setAI('greedy');
  }

  function newGame() {
    clearTimer();
    selected = null;
    lastPlaced = null;
    pinchAnim = null;
    game = Game.create();
    game.turn = firstPlayer;
    lastPhase = Game.PHASE_PLACE;
    if (aiEngine) aiColor = firstPlayer === 'B' ? 'W' : 'B';
    const overlay = document.getElementById('winner-overlay');
    if (overlay) overlay.classList.remove('show');
    render();
    updateStatus();
    scheduleAI();
  }

  function setAI(level) {
    aiEngine = level ? AI.get(level) : null;
    aiColor = aiEngine ? (firstPlayer === 'B' ? 'W' : 'B') : null;
    newGame();
  }

  function setFirst(color) {
    firstPlayer = color;
    newGame();
  }

  function setHints(on) { showHints = on; render(); }
  function setMultiPinch(on) { multiPinch = on; }
  function setSound(on) { soundOn = on; }
  function sfx(name) { if (soundOn) Sound[name](); }

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
    drawFormationHighlights();
    drawPieces();
    drawPinchAnim();
    drawSelection();
    if (game.state === Game.STATE_WAIT_PINCH_SELECT && showHints) drawPinchTargets();
  }

  function drawPinchAnim() {
    if (!pinchAnim) return;
    const { x, y } = toPixel(pinchAnim.r, pinchAnim.c);
    if (pinchAnim.phase === 'target') {
      // Pulsing red crosshair on target
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, PIECE_R + 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, PIECE_R + 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,50,50,0.4)'; ctx.lineWidth = 6; ctx.stroke();
      // Crosshair lines
      ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 2;
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * (PIECE_R + 4), y + dy * (PIECE_R + 4));
        ctx.lineTo(x + dx * (PIECE_R + 20), y + dy * (PIECE_R + 20));
        ctx.stroke();
      }
    } else if (pinchAnim.phase === 'removed') {
      // Expanding red ring where piece was removed
      ctx.strokeStyle = 'rgba(255,50,50,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, PIECE_R + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,50,50,0.15)';
      ctx.beginPath(); ctx.arc(x, y, PIECE_R + 12, 0, Math.PI * 2); ctx.fill();
      // X mark
      ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x-14, y-14); ctx.lineTo(x+14, y+14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+14, y-14); ctx.lineTo(x-14, y+14); ctx.stroke();
      ctx.lineCap = 'butt';
    }
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
    ctx.fillStyle = 'rgba(100, 180, 255, 0.5)';
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

  function drawFormationHighlights() {
    if (!showHints || !game.newFormations.length) return;
    ctx.strokeStyle = 'rgba(255,40,40,0.85)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const f of game.newFormations) {
      const cells = f.cells;
      if (cells.length < 2) continue;
      ctx.beginPath();
      if (f.type === 'square') {
        // Draw as rectangle: top-left, top-right, bottom-right, bottom-left
        const [tl, tr, bl, br] = cells;
        const p0 = toPixel(tl[0], tl[1]);
        const p1 = toPixel(tr[0], tr[1]);
        const p2 = toPixel(br[0], br[1]);
        const p3 = toPixel(bl[0], bl[1]);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
      } else {
        const p0 = toPixel(cells[0][0], cells[0][1]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < cells.length; i++) {
          const p = toPixel(cells[i][0], cells[i][1]);
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
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

  function onTouch(e) {
    e.preventDefault();
    Sound.unlock();
    const t = e.changedTouches[0];
    onClick({ clientX: t.clientX, clientY: t.clientY });
  }

  // ===================== Click handling =====================
  function onClick(e) {
    Sound.unlock();
    if (game.phase === Game.PHASE_OVER) return;
    if (aiEngine && game.turn === aiColor) return;
    if (blindTimer) return;

    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const pos = toBoard((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale);
    if (!pos) return;
    const { r, c } = pos;

    if (game.state === Game.STATE_WAIT_ACTION) {
      if (game.phase === Game.PHASE_PLACE) {
        const result = Game.place(game, r, c);
        if (result) { sfx('place'); lastPlaced = { r, c }; afterAction(result); }
      } else {
        if (selected) {
          if (game.board[r][c] === game.turn) { selected = { r, c }; render(); return; }
          const result = Game.move(game, selected.r, selected.c, r, c);
          if (result) { sfx('place'); lastPlaced = { r: r, c: c }; selected = null; afterAction(result); }
        } else if (game.board[r][c] === game.turn) {
          selected = { r, c }; render();
        }
      }
    } else if (game.state === Game.STATE_WAIT_PINCH_SELECT) {
      const result = Game.pinch(game, r, c);
      if (result) {
        sfx('pinch');
        pinchAnim = { r, c, phase: 'removed' };
        render(); updateStatus();
        setTimeout(() => { pinchAnim = null; render(); }, 800);
        if (result.gameOver) { clearTimer(); return showWinner(); }
        if (!result.more) { clearTimer(); continueGame(); }
      }
    } else if (game.state === Game.STATE_WAIT_SACRIFICE) {
      const result = Game.sacrifice(game, r, c);
      if (result) {
        render(); updateStatus();
        if (result.gameOver) return showWinner();
        continueGame();
      }
    }
  }

  let lastPhase = Game.PHASE_PLACE;

  function afterAction(result) {
    if (!multiPinch && game.pinchesRemaining > 1) game.pinchesRemaining = 1;
    render();
    updateStatus();
    if (game.phase === Game.PHASE_OVER) return showWinner();

    if (!showHints) {
      // Blind mode: always show 10s timer, player can try to pinch
      if (result.newFormations && result.newFormations.length > 0) {
        startPinchTimer();
      } else {
        startBlindTimer();
      }
    } else if (result.newFormations && result.newFormations.length > 0) {
      sfx('formation');
      startPinchTimer();
    } else {
      continueGame();
    }
  }

  // ===================== 10-second pinch timer =====================
  function startPinchTimer() {
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
    claimTimeTotal = 10000;
    claimTimeLeft = 10000;
    timerPaused = false;
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
        continueGame();
      }
    }, tick);
  }

  function startBlindTimer() {
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
    blindTimer = true;
    claimTimeTotal = 10000;
    claimTimeLeft = 10000;
    updateStatus();
    updateTimerBar();
    const tick = 50;
    claimTimer = setInterval(() => {
      claimTimeLeft -= tick;
      updateTimerBar();
      if (claimTimeLeft <= 0) {
        clearTimer();
        continueGame();
      }
    }, tick);
  }

  function clearTimer() {
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
    claimTimeLeft = 0;
    blindTimer = false;
    timerPaused = false;
    updateTimerBar();
  }

  let timerPaused = false;

  function pauseTimer() {
    if (blindTimer) { clearTimer(); continueGame(); return; }
    if (!showHints) { clearTimer(); Game.expireClaim(game); render(); updateStatus(); continueGame(); return; }
    if (game.state !== Game.STATE_WAIT_PINCH_SELECT || timerPaused) return;
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }
    timerPaused = true;
    updateStatus();
  }

  function claimPinch() {} // kept for compatibility

  // ===================== AI =====================
  function continueGame() {
    if (game.phase === Game.PHASE_OVER) return showWinner();
    if (lastPhase === Game.PHASE_PLACE && game.phase === Game.PHASE_MOVE) {
      lastPhase = game.phase;
      showPhaseOverlay();
      return;
    }
    lastPhase = game.phase;
    if (game.state === Game.STATE_WAIT_SACRIFICE) {
      showSacrificeOverlay();
      return;
    }
    scheduleAI();
  }

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
        continueGame();
      }
      return;
    }
    if (game.state !== Game.STATE_WAIT_ACTION) return;

    let result;
    if (game.phase === Game.PHASE_PLACE) {
      const m = aiEngine.choosePlace(game);
      if (m) { result = Game.place(game, m.r, m.c); lastPlaced = { r: m.r, c: m.c }; sfx('place'); }
    } else {
      const m = aiEngine.chooseMove(game);
      if (m) { result = Game.move(game, m.fr, m.fc, m.tr, m.tc); lastPlaced = { r: m.tr, c: m.tc }; sfx('place'); }
    }

    if (result) {
      if (!multiPinch && game.pinchesRemaining > 1) game.pinchesRemaining = 1;
      render();
      if (result.newFormations && result.newFormations.length > 0) {
        sfx('formation');
        startAIPinchTimer();
        return;
      }
      updateStatus();
      continueGame();
    }
  }

  function startAIPinchTimer() {
    claimTimeTotal = 2000;
    claimTimeLeft = 2000;
    updateStatus();
    updateTimerBar();
    const tick = 50;
    claimTimer = setInterval(() => {
      claimTimeLeft -= tick;
      updateTimerBar();
      if (claimTimeLeft <= 0) {
        clearTimer();
        doAIPinch();
      }
    }, tick);
  }

  function doAIPinch() {
    if (game.state !== Game.STATE_WAIT_PINCH_SELECT) return;
    const t = aiEngine.choosePinch(game);
    if (!t) { scheduleAI(); return; }

    // Phase 1: show crosshair on target for 1s
    pinchAnim = { r: t[0], c: t[1], phase: 'target' };
    render(); updateStatus();

    setTimeout(() => {
      // Phase 2: execute pinch
      const result = Game.pinch(game, t[0], t[1]);
      sfx('pinch');
      pinchAnim = { r: t[0], c: t[1], phase: 'removed' };
      render(); updateStatus();

      setTimeout(() => {
        pinchAnim = null;
        render(); updateStatus();
        if (result && result.gameOver) return showWinner();
        if (result && result.more) { setTimeout(doAIPinch, 500); return; }
        setTimeout(() => continueGame(), 500);
      }, 1000);
    }, 1000);
  }

  // ===================== UI updates =====================
  const TYPE_NAMES = { diag3: '三斜', diag4: '四斜', diag5: '通天', line5: '大棍', square: '方' };
  function formationNames(formations) {
    if (!formations || !formations.length) return '成形';
    const names = [...new Set(formations.map(f => TYPE_NAMES[f.type] || f.type))];
    return names.join('＋');
  }

  function updateStatus() {
    const el = document.getElementById('status');
    if (!el) return;

    const phaseNames = { [Game.PHASE_PLACE]: '下子阶段', [Game.PHASE_MOVE]: '走子阶段', [Game.PHASE_OVER]: '游戏结束' };
    const turnIcon = game.turn === 'B' ? '●' : '○';
    const turnName = game.turn === 'B' ? '黑方' : '白方';

    let msg = '';
    if (blindTimer) {
      msg = '结束本轮，换手';
    } else switch (game.state) {
      case Game.STATE_WAIT_ACTION:
        msg = game.phase === Game.PHASE_PLACE ? '请落子' : '选择棋子移动';
        break;
      case Game.STATE_WAIT_PINCH_SELECT: msg = showHints ? `${formationNames(game.newFormations)}！请掐子 (${game.pinchesRemaining}次)` : '结束本轮，换手'; break;
      case Game.STATE_WAIT_SACRIFICE: msg = '无路可走，请献祭一子'; break;
      default: if (game.winner) msg = `${game.winner === 'B' ? '黑方' : '白方'}获胜！`; break;
    }

    el.innerHTML = `<span class="phase-tag">${phaseNames[game.phase]}</span> ` +
      `<span class="turn-indicator ${game.turn === 'B' ? 'turn-black' : 'turn-white'}">${turnIcon} ${turnName}</span> ` +
      `<span class="status-msg">${msg}</span>`;

    // Claim button - shows during pinch selection as status indicator
    const btn = document.getElementById('btn-claim');
    if (btn) {
      const show = game.state === Game.STATE_WAIT_PINCH_SELECT || blindTimer;
      btn.style.display = show ? 'flex' : 'none';
      btn.classList.toggle('active', show);
      const txt = btn.querySelector('.claim-text');
      if (txt) {
        const fname = formationNames(game.newFormations);
        const isAITurn = aiEngine && game.turn === aiColor;
        if (blindTimer || (!showHints && !isAITurn)) txt.textContent = `⏳ 结束本轮，换手（可掐子）`;
        else if (isAITurn) txt.textContent = `🤖 ${fname}，AI正在选择掐子...`;
        else if (timerPaused) txt.textContent = `⏸ ${fname}，请选择要掐的棋子 (${game.pinchesRemaining})`;
        else txt.textContent = `🎯 ${fname}，点我暂停计时，或直接掐子 (${game.pinchesRemaining})`;
      }
    }

    // Piece counts
    const bEl = document.getElementById('count-b');
    const wEl = document.getElementById('count-w');
    if (bEl) bEl.textContent = Game.pieceCount(game, 'B');
    if (wEl) wEl.textContent = Game.pieceCount(game, 'W');

    // Move count
    const moveEl = document.getElementById('move-count');
    if (moveEl) moveEl.textContent = game.phase === Game.PHASE_PLACE ? `${game.placedCount}/25` : '—';

    // Cursor
    if (canvas) canvas.style.cursor = game.phase === Game.PHASE_OVER ? 'default' : makeCursor(game.turn);
  }

  const cursorCache = {};
  function makeCursor(color) {
    if (cursorCache[color]) return cursorCache[color];
    const s = 36, r = s / 2;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    // Outer glow ring
    x.beginPath(); x.arc(r, r, r - 2, 0, Math.PI * 2);
    x.strokeStyle = color === 'B' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    x.lineWidth = 3; x.stroke();
    // Piece body
    x.beginPath(); x.arc(r, r, r - 5, 0, Math.PI * 2);
    const g = x.createRadialGradient(r - 4, r - 4, 1, r, r, r - 5);
    if (color === 'B') { g.addColorStop(0, '#555'); g.addColorStop(1, '#111'); }
    else { g.addColorStop(0, '#fff'); g.addColorStop(1, '#ccc'); }
    x.fillStyle = g; x.fill();
    x.strokeStyle = color === 'B' ? '#000' : '#999'; x.lineWidth = 1.5; x.stroke();
    // Center dot for precision
    x.fillStyle = color === 'B' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
    x.beginPath(); x.arc(r, r, 3, 0, Math.PI * 2); x.fill();
    cursorCache[color] = `url(${c.toDataURL()}) ${r} ${r}, pointer`;
    return cursorCache[color];
  }

  function updateTimerBar() {
    const fill = document.getElementById('timer-fill');
    if (!fill) return;
    fill.style.width = Math.max(0, claimTimeLeft / claimTimeTotal * 100) + '%';
  }

  function showSacrificeOverlay() {
    const el = document.getElementById('phase-overlay');
    if (!el) { scheduleAI(); return; }
    const name = game.turn === 'B' ? '黑方' : '白方';
    const icon = game.turn === 'B' ? '⚫' : '⚪';
    el.innerHTML = `<div class="phase-title">🚫 ${icon} ${name}无路可走</div><div class="phase-sub">必须献祭一颗己方棋子</div>`;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      scheduleAI();
    }, 2000);
  }

  function showPhaseOverlay() {
    const el = document.getElementById('phase-overlay');
    if (!el) { continueGame(); return; }
    el.innerHTML = '<div class="phase-title">⚔️ 走子阶段</div><div class="phase-sub">移除死子，轮流移动棋子</div>';
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      continueGame();
    }, 2000);
  }

  function showWinner() {
    render(); updateStatus();
    sfx('win');
    const overlay = document.getElementById('winner-overlay');
    if (overlay && game.winner) {
      const icon = game.winner === 'B' ? '⚫' : '⚪';
      const name = game.winner === 'B' ? '黑方' : '白方';
      overlay.textContent = `🏆 ${icon} ${name}获胜！`;
      overlay.classList.add('show');
    }
  }

  function undoMove() {
    clearTimer();
    selected = null;
    lastPlaced = null;
    if (Game.undo(game)) {
      if (aiEngine) Game.undo(game);
      render(); updateStatus();
    }
  }

  function surrender() {
    if (game.phase === Game.PHASE_OVER) return;
    const human = aiEngine ? (aiColor === 'B' ? 'W' : 'B') : game.turn;
    game.winner = human === 'B' ? 'W' : 'B';
    game.phase = Game.PHASE_OVER;
    game.state = 'over';
    clearTimer();
    showWinner();
  }

  return { init, newGame, setAI, setFirst, setHints, setMultiPinch, setSound, claimPinch, pauseTimer, undoMove, surrender, render };
})();
