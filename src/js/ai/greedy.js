// Level 2: Greedy AI - evaluates each move by heuristic, picks best
const AIGreedy = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';

  // Board position weights - center is more valuable
  const POS_WEIGHT = [
    [1, 1, 1, 1, 1],
    [1, 2, 2, 2, 1],
    [1, 2, 3, 2, 1],
    [1, 2, 2, 2, 1],
    [1, 1, 1, 1, 1],
  ];

  function evaluate(g, color) {
    let score = 0;
    const o = opp(color);
    // Piece count
    score += (Game.pieceCount(g, color) - Game.pieceCount(g, o)) * 10;
    // Formations
    score += Formation.findAll(g.board, color).length * 15;
    score -= Formation.findAll(g.board, o).length * 15;
    // Position value
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (g.board[r][c] === color) score += POS_WEIGHT[r][c];
        else if (g.board[r][c] === o) score -= POS_WEIGHT[r][c];
    return score;
  }

  function bestOf(moves, g, applyFn) {
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      const sim = Game.clone(g);
      applyFn(sim, m);
      const s = evaluate(sim, g.turn);
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  function choosePlace(g) {
    const moves = Game.getLegalMoves(g, g.turn);
    return bestOf(moves, g, (sim, m) => { sim.board[m.r][m.c] = g.turn; });
  }

  function chooseMove(g) {
    const moves = Game.getLegalMoves(g, g.turn);
    return bestOf(moves, g, (sim, m) => {
      sim.board[m.fr][m.fc] = null;
      sim.board[m.tr][m.tc] = g.turn;
    });
  }

  function choosePinch(g) {
    const targets = Formation.pinchTargets(g.board, opp(g.turn));
    // Pick target that hurts opponent formations most
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
    // Sacrifice least valuable piece
    let best = own[0], bestScore = -Infinity;
    for (const [r, c] of own) {
      const sim = Game.clone(g);
      sim.board[r][c] = null;
      const s = evaluate(sim, g.turn);
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    return best;
  }

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, evaluate, name: 'Greedy' };
})();
