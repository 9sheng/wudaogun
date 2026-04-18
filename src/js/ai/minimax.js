// Level 3: Minimax with Alpha-Beta Pruning
const AIMinimax = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';
  const MAX_DEPTH_PLACE = 3;
  const MAX_DEPTH_MOVE = 4;

  function evaluate(g, color) {
    const o = opp(color);
    let score = 0;
    score += (Game.pieceCount(g, color) - Game.pieceCount(g, o)) * 20;
    const myF = Formation.findAll(g.board, color);
    const opF = Formation.findAll(g.board, o);
    for (const f of myF) {
      if (f.type === 'diag5' || f.type === 'line5') score += 50;
      else if (f.type === 'diag4') score += 30;
      else if (f.type === 'diag3' || f.type === 'square') score += 20;
    }
    for (const f of opF) {
      if (f.type === 'diag5' || f.type === 'line5') score -= 50;
      else if (f.type === 'diag4') score -= 30;
      else if (f.type === 'diag3' || f.type === 'square') score -= 20;
    }
    // Mobility in move phase
    if (g.phase === Game.PHASE_MOVE) {
      score += Game.getLegalMoves(g, color).length * 2;
      score -= Game.getLegalMoves(g, o).length * 2;
    }
    return score;
  }

  function applyMove(sim, m, color) {
    if (m.r !== undefined) {
      sim.board[m.r][m.c] = color;
    } else {
      sim.board[m.fr][m.fc] = null;
      sim.board[m.tr][m.tc] = color;
    }
  }

  function undoMove(sim, m, color) {
    if (m.r !== undefined) {
      sim.board[m.r][m.c] = null;
    } else {
      sim.board[m.fr][m.fc] = color;
      sim.board[m.tr][m.tc] = null;
    }
  }

  function minimax(g, depth, alpha, beta, maximizing, rootColor) {
    if (depth === 0) return evaluate(g, rootColor);
    const color = maximizing ? rootColor : opp(rootColor);
    const moves = Game.getLegalMoves(g, color);
    if (moves.length === 0) return evaluate(g, rootColor);

    if (maximizing) {
      let val = -Infinity;
      for (const m of moves) {
        applyMove(g, m, color);
        val = Math.max(val, minimax(g, depth - 1, alpha, beta, false, rootColor));
        undoMove(g, m, color);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return val;
    } else {
      let val = Infinity;
      for (const m of moves) {
        applyMove(g, m, color);
        val = Math.min(val, minimax(g, depth - 1, alpha, beta, true, rootColor));
        undoMove(g, m, color);
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return val;
    }
  }

  function bestMove(g) {
    const moves = Game.getLegalMoves(g, g.turn);
    const depth = g.phase === Game.PHASE_PLACE ? MAX_DEPTH_PLACE : MAX_DEPTH_MOVE;
    let best = moves[0], bestScore = -Infinity;
    const sim = Game.clone(g);
    for (const m of moves) {
      applyMove(sim, m, g.turn);
      const s = minimax(sim, depth - 1, -Infinity, Infinity, false, g.turn);
      undoMove(sim, m, g.turn);
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
      const s = evaluate(sim, g.turn);
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
      const s = evaluate(sim, g.turn);
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    return best;
  }

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, name: 'Minimax' };
})();
