// Core game state for 5x5 Strategy Game
const Game = (() => {
  const SIZE = 5;
  const PHASE_PLACE = 1, PHASE_MOVE = 2, PHASE_OVER = 3;
  const STATE_WAIT_ACTION = 'waitAction';       // waiting for place/move
  const STATE_WAIT_PINCH_CLAIM = 'waitClaim';   // 5s window to claim formation
  const STATE_WAIT_PINCH_SELECT = 'waitSelect';  // player selecting which piece to pinch
  const STATE_WAIT_SACRIFICE = 'waitSacrifice';  // player must sacrifice own piece

  function create() {
    const board = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
    return {
      board,
      turn: 'B',           // 'B' or 'W'
      phase: PHASE_PLACE,
      state: STATE_WAIT_ACTION,
      placedCount: 0,
      deadPieces: [],       // [{r,c,color}] marked dead in phase 1
      formations: { B: [], W: [] }, // current formations per color
      pinchesRemaining: 0,
      newFormations: [],    // formations that triggered current pinch
      history: [],          // for undo
      winner: null,
    };
  }

  function clone(g) {
    return {
      board: g.board.map(r => [...r]),
      turn: g.turn,
      phase: g.phase,
      state: g.state,
      placedCount: g.placedCount,
      deadPieces: g.deadPieces.map(d => ({...d})),
      formations: { B: [...g.formations.B], W: [...g.formations.W] },
      pinchesRemaining: g.pinchesRemaining,
      newFormations: [...g.newFormations],
      history: [], // don't clone history for AI
      winner: g.winner,
    };
  }

  function snapshot(g) {
    return JSON.parse(JSON.stringify({
      board: g.board, turn: g.turn, phase: g.phase, state: g.state,
      placedCount: g.placedCount, deadPieces: g.deadPieces,
      formations: g.formations, pinchesRemaining: g.pinchesRemaining,
      newFormations: g.newFormations, winner: g.winner,
    }));
  }

  function pushHistory(g) {
    g.history.push(snapshot(g));
  }

  function undo(g) {
    if (!g.history.length) return false;
    const prev = g.history.pop();
    Object.assign(g, prev);
    g.history = g.history || [];
    return true;
  }

  function aliveColor(cell) {
    return cell === 'B' || cell === 'W' ? cell : null;
  }

  // Phase 1: place a piece
  function place(g, r, c) {
    if (g.phase !== PHASE_PLACE || g.state !== STATE_WAIT_ACTION) return false;
    if (g.board[r][c] !== null) return false;
    pushHistory(g);
    g.board[r][c] = g.turn;
    g.placedCount++;

    // Check for new formations
    const prevF = g.formations[g.turn];
    const allF = Formation.findAll(g.board, g.turn);
    const newF = Formation.findNew(g.board, g.turn, prevF);
    g.formations[g.turn] = allF;

    if (newF.length > 0) {
      g.newFormations = newF;
      g.pinchesRemaining = Formation.pinchCount(newF);
      g.state = STATE_WAIT_PINCH_SELECT;
      return { action: 'placed', newFormations: newF };
    }
    endTurn(g);
    return { action: 'placed', newFormations: [] };
  }

  // Player claims "I want to pinch" within 5s window
  function claimPinch(g) {
    if (g.state !== STATE_WAIT_PINCH_CLAIM) return false;
    if (g.newFormations.length === 0) {
      // False claim - force end turn
      g.newFormations = [];
      g.pinchesRemaining = 0;
      endTurn(g);
      return { valid: false };
    }
    g.state = STATE_WAIT_PINCH_SELECT;
    return { valid: true, count: g.pinchesRemaining };
  }

  // 5s window expired without claiming
  function expireClaim(g) {
    if (g.state !== STATE_WAIT_PINCH_SELECT) return false;
    g.newFormations = [];
    g.pinchesRemaining = 0;
    endTurn(g);
    return true;
  }

  // Select opponent piece to pinch
  function pinch(g, r, c) {
    if (g.state !== STATE_WAIT_PINCH_SELECT || g.pinchesRemaining <= 0) return false;
    const opp = g.turn === 'B' ? 'W' : 'B';
    if (g.board[r][c] !== opp) return false;
    // Only allow pinching valid targets (non-formation pieces first)
    const targets = Formation.pinchTargets(g.board, opp);
    if (!targets.some(t => t[0] === r && t[1] === c)) return false;

    if (g.phase === PHASE_PLACE) {
      // Mark as dead (stays on board but inactive)
      g.board[r][c] = 'D' + opp;
      g.deadPieces.push({r, c, color: opp});
    } else {
      // Phase 2: remove immediately
      g.board[r][c] = null;
    }
    g.pinchesRemaining--;

    // Recalculate formations after removal
    g.formations.B = Formation.findAll(g.board, 'B');
    g.formations.W = Formation.findAll(g.board, 'W');

    // Check win condition (phase 2)
    if (g.phase === PHASE_MOVE && checkWin(g)) return { action: 'pinched', gameOver: true };

    if (g.pinchesRemaining > 0) return { action: 'pinched', more: true };
    g.newFormations = [];
    endTurn(g);
    return { action: 'pinched', more: false };
  }

  // Phase 2: move a piece
  function move(g, fr, fc, tr, tc) {
    if (g.phase !== PHASE_MOVE || g.state !== STATE_WAIT_ACTION) return false;
    if (g.board[fr][fc] !== g.turn) return false;
    if (g.board[tr][tc] !== null) return false;
    if (!isAdjacent(fr, fc, tr, tc)) return false;

    pushHistory(g);
    g.board[fr][fc] = null;
    g.board[tr][tc] = g.turn;

    const prevF = g.formations[g.turn];
    const allF = Formation.findAll(g.board, g.turn);
    const newF = Formation.findNew(g.board, g.turn, prevF);
    g.formations[g.turn] = allF;

    if (newF.length > 0) {
      g.newFormations = newF;
      g.pinchesRemaining = Formation.pinchCount(newF);
      g.state = STATE_WAIT_PINCH_SELECT;
      return { action: 'moved', newFormations: newF };
    }
    endTurn(g);
    return { action: 'moved', newFormations: [] };
  }

  // Sacrifice own piece when no legal moves
  function sacrifice(g, r, c) {
    if (g.state !== STATE_WAIT_SACRIFICE) return false;
    if (g.board[r][c] !== g.turn) return false;
    pushHistory(g);
    g.board[r][c] = null;
    g.formations[g.turn] = Formation.findAll(g.board, g.turn);
    if (checkWin(g)) return { action: 'sacrificed', gameOver: true };
    endTurn(g);
    return { action: 'sacrificed' };
  }

  function endTurn(g) {
    g.turn = g.turn === 'B' ? 'W' : 'B';
    g.newFormations = [];
    g.pinchesRemaining = 0;

    if (g.phase === PHASE_PLACE && g.placedCount >= 25) {
      transitionToPhase2(g);
      return;
    }
    if (g.phase === PHASE_MOVE) {
      if (!hasLegalMoves(g, g.turn)) {
        g.state = STATE_WAIT_SACRIFICE;
        return;
      }
    }
    g.state = STATE_WAIT_ACTION;
  }

  function transitionToPhase2(g) {
    // Remove all dead pieces
    for (const d of g.deadPieces) g.board[d.r][d.c] = null;
    g.deadPieces = [];
    g.phase = PHASE_MOVE;
    g.formations.B = Formation.findAll(g.board, 'B');
    g.formations.W = Formation.findAll(g.board, 'W');
    if (!hasLegalMoves(g, g.turn)) {
      g.state = STATE_WAIT_SACRIFICE;
    } else {
      g.state = STATE_WAIT_ACTION;
    }
  }

  function isAdjacent(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
    return (dr + dc === 1); // orthogonal only
  }

  function hasLegalMoves(g, color) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (g.board[r][c] === color)
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = r+dr, nc = c+dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && g.board[nr][nc] === null)
              return true;
          }
    return false;
  }

  function getLegalMoves(g, color) {
    const moves = [];
    if (g.phase === PHASE_PLACE) {
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          if (g.board[r][c] === null) moves.push({r, c});
    } else {
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          if (g.board[r][c] === color)
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
              const nr = r+dr, nc = c+dc;
              if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && g.board[nr][nc] === null)
                moves.push({fr: r, fc: c, tr: nr, tc: nc});
            }
    }
    return moves;
  }

  function checkWin(g) {
    let bCount = 0, wCount = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (g.board[r][c] === 'B') bCount++;
        if (g.board[r][c] === 'W') wCount++;
      }
    if (wCount === 0) { g.winner = 'B'; g.phase = PHASE_OVER; g.state = 'over'; return true; }
    if (bCount === 0) { g.winner = 'W'; g.phase = PHASE_OVER; g.state = 'over'; return true; }
    return false;
  }

  function pieceCount(g, color) {
    let n = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (g.board[r][c] === color) n++;
    return n;
  }

  return {
    create, clone, place, move, claimPinch, expireClaim, pinch, sacrifice,
    undo, getLegalMoves, hasLegalMoves, pieceCount, isAdjacent, checkWin,
    PHASE_PLACE, PHASE_MOVE, PHASE_OVER,
    STATE_WAIT_ACTION, STATE_WAIT_PINCH_CLAIM, STATE_WAIT_PINCH_SELECT, STATE_WAIT_SACRIFICE,
    SIZE,
  };
})();
