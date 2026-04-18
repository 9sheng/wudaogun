// Level 2: Greedy AI - uses advanced evaluation, picks best single move
const AIGreedy = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';

  function evaluate(g, color) {
    return AIEval.evaluate(g.board, color, g.phase);
  }

  function bestOf(moves, g, applyFn) {
    let bestScore = -Infinity;
    const scored = [];
    for (const m of moves) {
      const sim = Game.clone(g);
      applyFn(sim, m);
      const s = AIEval.evaluate(sim.board, g.turn, g.phase);
      scored.push({ m, s });
      if (s > bestScore) bestScore = s;
    }
    const threshold = bestScore - 5;
    const top = scored.filter(x => x.s >= threshold);
    return top[Math.floor(Math.random() * top.length)].m;
  }

  function choosePlace(g) {
    return bestOf(Game.getLegalMoves(g, g.turn), g, (sim, m) => { sim.board[m.r][m.c] = g.turn; });
  }

  function chooseMove(g) {
    return bestOf(Game.getLegalMoves(g, g.turn), g, (sim, m) => {
      sim.board[m.fr][m.fc] = null; sim.board[m.tr][m.tc] = g.turn;
    });
  }

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

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, evaluate, name: 'Greedy' };
})();
