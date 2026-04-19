// Level 4: Monte Carlo Tree Search (MCTS)
const AIMCTS = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';
  const TIME_BUDGET = 1500; // ms
  const C = 1.41; // UCB1 exploration constant

  class Node {
    constructor(g, move, parent, color) {
      this.g = g;
      this.move = move;
      this.parent = parent;
      this.color = color; // color that MADE the move to reach this node
      this.children = [];
      this.visits = 0;
      this.wins = 0;
      this.untriedMoves = Game.getLegalMoves(g, g.turn);
    }

    ucb1() {
      if (this.visits === 0) return Infinity;
      return (this.wins / this.visits) + C * Math.sqrt(Math.log(this.parent.visits) / this.visits);
    }

    bestChild() {
      let best = null, bestUCB = -Infinity;
      for (const ch of this.children) {
        const u = ch.ucb1();
        if (u > bestUCB) { bestUCB = u; best = ch; }
      }
      return best;
    }
  }

  function applyMoveToSim(sim, m, color) {
    const prevF = Formation.findAll(sim.board, color);
    if (m.r !== undefined) {
      sim.board[m.r][m.c] = color;
      sim.placedCount++;
    } else {
      sim.board[m.fr][m.fc] = null;
      sim.board[m.tr][m.tc] = color;
    }
    // Simulate pinch
    const o = opp(color);
    const newF = Formation.findNew(sim.board, color, prevF);
    for (let i = 0; i < newF.length; i++) {
      const targets = Formation.pinchTargets(sim.board, o);
      if (targets.length === 0) break;
      const [r, c] = targets[Math.floor(Math.random() * targets.length)];
      sim.board[r][c] = sim.phase === Game.PHASE_PLACE ? 'D' + o : null;
    }
    sim.turn = opp(color);
    if (sim.phase === Game.PHASE_PLACE && sim.placedCount >= 25) {
      sim.phase = Game.PHASE_MOVE;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++)
          if (sim.board[r][c] && sim.board[r][c][0] === 'D') sim.board[r][c] = null;
    }
  }

  function simulate(g, rootColor) {
    const sim = Game.clone(g);
    let depth = 0;
    while (depth < 50) {
      const moves = Game.getLegalMoves(sim, sim.turn);
      if (moves.length === 0) {
        // Check if stuck = sacrifice simulation
        const own = [];
        for (let r = 0; r < 5; r++)
          for (let c = 0; c < 5; c++)
            if (sim.board[r][c] === sim.turn) own.push([r, c]);
        if (own.length === 0) return sim.turn === rootColor ? 0 : 1;
        // Sacrifice random piece
        const [sr, sc] = own[Math.floor(Math.random() * own.length)];
        sim.board[sr][sc] = null;
        sim.turn = opp(sim.turn);
      } else {
        const m = moves[Math.floor(Math.random() * moves.length)];
        applyMoveToSim(sim, m, sim.turn);
      }
      // Check terminal
      const bc = Game.pieceCount(sim, 'B'), wc = Game.pieceCount(sim, 'W');
      if (sim.phase === Game.PHASE_MOVE) {
        if (bc === 0) return rootColor === 'W' ? 1 : 0;
        if (wc === 0) return rootColor === 'B' ? 1 : 0;
      }
      depth++;
    }
    // Heuristic at depth limit
    return Game.pieceCount(sim, rootColor) >= Game.pieceCount(sim, opp(rootColor)) ? 0.6 : 0.4;
  }

  function search(g) {
    const root = new Node(Game.clone(g), null, null, opp(g.turn));
    const start = Date.now();

    while (Date.now() - start < TIME_BUDGET) {
      // 1. Selection
      let node = root;
      while (node.untriedMoves.length === 0 && node.children.length > 0) {
        node = node.bestChild();
      }

      // 2. Expansion
      if (node.untriedMoves.length > 0) {
        const idx = Math.floor(Math.random() * node.untriedMoves.length);
        const m = node.untriedMoves.splice(idx, 1)[0];
        const sim = Game.clone(node.g);
        const color = sim.turn;
        applyMoveToSim(sim, m, color);
        const child = new Node(sim, m, node, color);
        node.children.push(child);
        node = child;
      }

      // 3. Simulation
      const result = simulate(node.g, g.turn);

      // 4. Backpropagation
      while (node) {
        node.visits++;
        node.wins += result;
        node = node.parent;
      }
    }

    // Pick most visited child
    let best = null, bestVisits = -1;
    for (const ch of root.children) {
      if (ch.visits > bestVisits) { bestVisits = ch.visits; best = ch; }
    }
    return best ? best.move : Game.getLegalMoves(g, g.turn)[0];
  }

  function choosePlace(g) { return search(g); }
  function chooseMove(g) { return search(g); }

  function choosePinch(g) {
    // Use greedy evaluation for pinch target selection
    const targets = Formation.pinchTargets(g.board, opp(g.turn));
    if (targets.length <= 1) return targets[0];
    let best = targets[0], bestScore = -Infinity;
    for (const [r, c] of targets) {
      const sim = Game.clone(g);
      sim.board[r][c] = g.phase === Game.PHASE_PLACE ? 'D' + opp(g.turn) : null;
      const s = AIGreedy.evaluate(sim, g.turn);
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
      const s = AIGreedy.evaluate(sim, g.turn);
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    return best;
  }

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, name: 'MCTS' };
})();
