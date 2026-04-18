// Level 5: Iterative Deepening Negamax with alpha-beta + move ordering
const AINegamax = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';
  const TIME_BUDGET = 2000; // ms
  let deadline = 0;
  let aborted = false;

  function applyMove(board, m, color) {
    if (m.r !== undefined) board[m.r][m.c] = color;
    else { board[m.fr][m.fc] = null; board[m.tr][m.tc] = color; }
  }
  function undoMove(board, m, color) {
    if (m.r !== undefined) board[m.r][m.c] = null;
    else { board[m.fr][m.fc] = color; board[m.tr][m.tc] = null; }
  }

  function negamax(board, depth, alpha, beta, color, phase) {
    if (aborted) return 0;
    if (Date.now() > deadline) { aborted = true; return 0; }
    if (depth === 0) return AIEval.evaluate(board, color, phase);

    const g = { board, phase, turn: color };
    const moves = Game.getLegalMoves(g, color);
    if (moves.length === 0) return AIEval.evaluate(board, color, phase);

    let bestVal = -Infinity;
    for (const m of moves) {
      applyMove(board, m, color);
      const val = -negamax(board, depth - 1, -beta, -alpha, opp(color), phase);
      undoMove(board, m, color);
      if (aborted) return 0;
      bestVal = Math.max(bestVal, val);
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return bestVal;
  }

  function search(g) {
    const board = g.board.map(r => [...r]);
    let moves = Game.getLegalMoves(g, g.turn);
    if (moves.length <= 1) return moves[0];

    // Quick score for initial ordering
    const scored = moves.map(m => {
      applyMove(board, m, g.turn);
      const s = AIEval.evaluate(board, g.turn, g.phase);
      undoMove(board, m, g.turn);
      return { m, s };
    });
    scored.sort((a, b) => b.s - a.s);
    moves = scored.map(x => x.m);

    deadline = Date.now() + TIME_BUDGET;
    const maxDepth = g.phase === Game.PHASE_PLACE ? 6 : 8;

    // Iterative deepening
    let lastScores = scored;
    for (let depth = 1; depth <= maxDepth; depth++) {
      aborted = false;
      let bestVal = -Infinity;
      const scores = [];

      for (const m of moves) {
        applyMove(board, m, g.turn);
        const val = -negamax(board, depth - 1, -Infinity, -bestVal, opp(g.turn), g.phase);
        undoMove(board, m, g.turn);
        if (aborted) break;
        scores.push({ m, s: val });
        if (val > bestVal) { bestVal = val; }
      }

      if (!aborted) {
        lastScores = scores;
        // Reorder moves by score for next iteration
        scores.sort((a, b) => b.s - a.s);
        moves = scores.map(x => x.m);
      }
      if (Date.now() > deadline) break;
    }
    // Pick randomly among top moves
    const best = lastScores.reduce((a, b) => a.s > b.s ? a : b).s;
    const top = lastScores.filter(x => x.s >= best - 3);
    return top[Math.floor(Math.random() * top.length)].m;
  }

  function choosePlace(g) { return search(g); }
  function chooseMove(g) { return search(g); }

  function choosePinch(g) {
    const targets = Formation.pinchTargets(g.board, opp(g.turn));
    if (targets.length <= 1) return targets[0];
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
    if (own.length <= 1) return own[0];
    let best = own[0], bestScore = -Infinity;
    for (const [r, c] of own) {
      const sim = Game.clone(g);
      sim.board[r][c] = null;
      const s = AIEval.evaluate(sim.board, g.turn, g.phase);
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    return best;
  }

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, name: 'Negamax' };
})();
