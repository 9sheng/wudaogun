// Level 3: Minimax with Alpha-Beta Pruning + move ordering
const AIMinimax = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';
  const MAX_DEPTH_PLACE = 4;
  const MAX_DEPTH_MOVE = 6;

  function evaluate(g, color) {
    return AIEval.evaluate(g.board, color, g.phase);
  }

  // Apply move + simulate pinch. Returns array of pinched cells for undo.
  function applyMove(board, m, color, phase) {
    const prevF = Formation.findAll(board, color);
    if (m.r !== undefined) { board[m.r][m.c] = color; }
    else { board[m.fr][m.fc] = null; board[m.tr][m.tc] = color; }
    const newF = Formation.findNew(board, color, prevF);
    const pinched = [];
    const o = opp(color);
    for (let i = 0; i < newF.length; i++) {
      const targets = Formation.pinchTargets(board, o);
      if (targets.length === 0) break;
      let best = 0;
      if (targets.length > 1) {
        let bs = -Infinity;
        for (let t = 0; t < targets.length; t++) {
          const [r, c] = targets[t];
          const sv = board[r][c];
          board[r][c] = phase === Game.PHASE_PLACE ? 'D' + o : null;
          const s = AIEval.evaluate(board, color, phase);
          board[r][c] = sv;
          if (s > bs) { bs = s; best = t; }
        }
      }
      const [r, c] = targets[best];
      pinched.push({ r, c, was: board[r][c] });
      board[r][c] = phase === Game.PHASE_PLACE ? 'D' + o : null;
    }
    return pinched;
  }
  function undoMove(board, m, color, pinched) {
    for (let i = pinched.length - 1; i >= 0; i--) board[pinched[i].r][pinched[i].c] = pinched[i].was;
    if (m.r !== undefined) { board[m.r][m.c] = null; }
    else { board[m.fr][m.fc] = color; board[m.tr][m.tc] = null; }
  }

  // Quick heuristic for move ordering (higher = search first)
  function moveScore(board, m, color, phase) {
    const p = applyMove(board, m, color, phase);
    const s = AIEval.evaluate(board, color, phase);
    undoMove(board, m, color, p);
    return s;
  }

  function orderMoves(moves, board, color, phase) {
    return moves.map(m => ({ m, s: moveScore(board, m, color, phase) }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.m);
  }

  function minimax(board, depth, alpha, beta, maximizing, rootColor, phase) {
    if (depth === 0) return AIEval.evaluate(board, rootColor, phase);
    const color = maximizing ? rootColor : opp(rootColor);
    const g = { board, phase, turn: color };
    let moves = Game.getLegalMoves(g, color);
    if (moves.length === 0) return AIEval.evaluate(board, rootColor, phase);

    // Order moves at higher depths for better pruning
    if (depth >= 2) moves = orderMoves(moves, board, color, phase);

    if (maximizing) {
      let val = -Infinity;
      for (const m of moves) {
        const p = applyMove(board, m, color, phase);
        val = Math.max(val, minimax(board, depth - 1, alpha, beta, false, rootColor, phase));
        undoMove(board, m, color, p);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return val;
    } else {
      let val = Infinity;
      for (const m of moves) {
        const p = applyMove(board, m, color, phase);
        val = Math.min(val, minimax(board, depth - 1, alpha, beta, true, rootColor, phase));
        undoMove(board, m, color, p);
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return val;
    }
  }

  function bestMove(g) {
    let moves = Game.getLegalMoves(g, g.turn);
    let depth = MAX_DEPTH_PLACE;
    if (g.phase === Game.PHASE_MOVE) {
      const total = Game.pieceCount(g, 'B') + Game.pieceCount(g, 'W');
      depth = total <= 6 ? 8 : total <= 10 ? MAX_DEPTH_MOVE : 5;
    }
    const board = g.board.map(r => [...r]);
    moves = orderMoves(moves, board, g.turn, g.phase);
    let bestScore = -Infinity;
    const scored = [];
    for (const m of moves) {
      const p = applyMove(board, m, g.turn, g.phase);
      const s = minimax(board, depth - 1, -Infinity, Infinity, false, g.turn, g.phase);
      undoMove(board, m, g.turn, p);
      scored.push({ m, s });
      if (s > bestScore) bestScore = s;
    }
    const threshold = bestScore - 3;
    const top = scored.filter(x => x.s >= threshold);
    return top[Math.floor(Math.random() * top.length)].m;
  }

  function choosePlace(g) { return bestMove(g); }
  function chooseMove(g) { return bestMove(g); }

  function choosePinch(g) {
    const targets = Formation.pinchTargets(g.board, opp(g.turn));
    let best = targets[0], bestScore = -Infinity;
    for (const [r, c] of targets) {
      const sim = Game.clone(g);
      sim.board[r][c] = g.phase === Game.PHASE_PLACE ? 'D' + opp(g.turn) : null;
      const s = AIEval.evaluate(sim.board, g.turn, g.phase);
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    return best;
  }

  function chooseSacrifice(g) {
    const own = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (g.board[r][c] === g.turn) own.push([r, c]);
    let best = own[0], bestScore = -Infinity;
    for (const [r, c] of own) {
      const sim = Game.clone(g);
      sim.board[r][c] = null;
      const s = AIEval.evaluate(sim.board, g.turn, g.phase);
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    return best;
  }

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, name: 'Minimax' };
})();
