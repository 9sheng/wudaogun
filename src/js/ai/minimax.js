// Level 3: Minimax with Alpha-Beta Pruning + move ordering
const AIMinimax = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';
  const MAX_DEPTH_PLACE = 4;
  const MAX_DEPTH_MOVE = 5;

  function evaluate(g, color) {
    return AIEval.evaluate(g.board, color, g.phase);
  }

  function applyMove(board, m, color) {
    if (m.r !== undefined) { board[m.r][m.c] = color; }
    else { board[m.fr][m.fc] = null; board[m.tr][m.tc] = color; }
  }
  function undoMove(board, m, color) {
    if (m.r !== undefined) { board[m.r][m.c] = null; }
    else { board[m.fr][m.fc] = color; board[m.tr][m.tc] = null; }
  }

  // Quick heuristic for move ordering (higher = search first)
  function moveScore(board, m, color, phase) {
    applyMove(board, m, color);
    const s = AIEval.evaluate(board, color, phase);
    undoMove(board, m, color);
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
        applyMove(board, m, color);
        val = Math.max(val, minimax(board, depth - 1, alpha, beta, false, rootColor, phase));
        undoMove(board, m, color);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return val;
    } else {
      let val = Infinity;
      for (const m of moves) {
        applyMove(board, m, color);
        val = Math.min(val, minimax(board, depth - 1, alpha, beta, true, rootColor, phase));
        undoMove(board, m, color);
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return val;
    }
  }

  function bestMove(g) {
    let moves = Game.getLegalMoves(g, g.turn);
    const depth = g.phase === Game.PHASE_PLACE ? MAX_DEPTH_PLACE : MAX_DEPTH_MOVE;
    const board = g.board.map(r => [...r]);
    moves = orderMoves(moves, board, g.turn, g.phase);
    let best = moves[0], bestScore = -Infinity;
    for (const m of moves) {
      applyMove(board, m, g.turn);
      const s = minimax(board, depth - 1, -Infinity, Infinity, false, g.turn, g.phase);
      undoMove(board, m, g.turn);
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
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
