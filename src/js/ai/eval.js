// Advanced evaluation function shared by AI engines
const AIEval = (() => {
  const opp = c => c === 'B' ? 'W' : 'B';

  // Position weights - center and edge-adjacent are strategic
  const POS = [
    [3, 2, 3, 2, 3],
    [2, 4, 3, 4, 2],
    [3, 3, 5, 3, 3],
    [2, 4, 3, 4, 2],
    [3, 2, 3, 2, 3],
  ];

  // Score a single formation
  function formationScore(f) {
    switch (f.type) {
      case 'diag5': case 'line5': return 80;
      case 'diag4': return 50;
      case 'diag3': case 'square': return 30;
    }
    return 0;
  }

  // Count "threats" - lines where we have N pieces and rest are empty
  // A threat means one more piece completes a formation
  function countThreats(board, color) {
    let threats = 0;
    // Check all pre-computed diagonal lines
    for (const line of Formation.DIAG_LINES) {
      let mine = 0, empty = 0;
      for (const [r, c] of line) {
        if (board[r][c] === color) mine++;
        else if (board[r][c] === null) empty++;
      }
      // Threat: need exactly 1 more piece, rest are mine
      if (mine === line.length - 1 && empty === 1) threats += line.length * 3;
      // Near-threat: need 2 more
      else if (mine === line.length - 2 && empty === 2) threats += line.length;
    }
    // Row/column threats for line5
    for (let i = 0; i < 5; i++) {
      let rm = 0, re = 0, cm = 0, ce = 0;
      for (let j = 0; j < 5; j++) {
        if (board[i][j] === color) rm++; else if (board[i][j] === null) re++;
        if (board[j][i] === color) cm++; else if (board[j][i] === null) ce++;
      }
      if (rm === 4 && re === 1) threats += 15;
      else if (rm === 3 && re === 2) threats += 5;
      if (cm === 4 && ce === 1) threats += 15;
      else if (cm === 3 && ce === 2) threats += 5;
    }
    // Square threats (2x2)
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        let m = 0, e = 0;
        for (const [dr, dc] of [[0,0],[0,1],[1,0],[1,1]]) {
          if (board[r+dr][c+dc] === color) m++;
          else if (board[r+dr][c+dc] === null) e++;
        }
        if (m === 3 && e === 1) threats += 10;
        else if (m === 2 && e === 2) threats += 3;
      }
    return threats;
  }

  // Connectivity: count adjacent same-color pairs
  function connectivity(board, color) {
    let conn = 0;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (board[r][c] === color)
          for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]])  {
            const nr = r+dr, nc = c+dc;
            if (nr < 5 && nc >= 0 && nc < 5 && board[nr][nc] === color) conn++;
          }
    return conn;
  }

  function evaluate(board, color, phase) {
    const o = opp(color);
    let score = 0;

    // Piece count (critical in move phase)
    const myCount = Game.pieceCount({board}, color);
    const opCount = Game.pieceCount({board}, o);
    if (phase === Game.PHASE_MOVE) {
      if (opCount === 0) return 10000;
      if (myCount === 0) return -10000;
      score += (myCount - opCount) * 50;
    } else {
      score += (myCount - opCount) * 15;
      // Penalize own dead pieces
      let myDead = 0, opDead = 0;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++) {
          if (board[r][c] === 'D' + color) myDead++;
          else if (board[r][c] === 'D' + o) opDead++;
        }
      score += (opDead - myDead) * 25;
    }

    // Formations
    const myF = Formation.findAll(board, color);
    const opF = Formation.findAll(board, o);
    for (const f of myF) score += formationScore(f);
    for (const f of opF) score -= formationScore(f) * 1.2;

    // Threats (near-formations)
    const myThreats = countThreats(board, color);
    const opThreats = countThreats(board, o);
    score += myThreats * 2.5;
    score -= opThreats * 2.8;

    // Double threats: multiple threats at once (opponent can only block one)
    const myImminent = countImminentThreats(board, color);
    const opImminent = countImminentThreats(board, o);
    if (myImminent >= 2) score += myImminent * 20;
    if (opImminent >= 2) score -= opImminent * 22;

    // Position control
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        if (board[r][c] === color) score += POS[r][c];
        else if (board[r][c] === o) score -= POS[r][c];
      }

    // Connectivity
    score += connectivity(board, color) * 2;
    score -= connectivity(board, o) * 2;

    // Mobility (move phase)
    if (phase === Game.PHASE_MOVE) {
      const g = { board, phase, turn: color };
      const myMoves = Game.getLegalMoves(g, color).length;
      const opMoves = Game.getLegalMoves(g, o).length;
      score += myMoves * 4;
      score -= opMoves * 4;
      // Trap detection: opponent has very few moves
      if (opMoves <= 1) score += 30;
    }

    return score;
  }

  // Count imminent threats (1 piece away from completing a formation)
  function countImminentThreats(board, color) {
    let count = 0;
    for (const line of Formation.DIAG_LINES) {
      let mine = 0, empty = 0;
      for (const [r, c] of line) {
        if (board[r][c] === color) mine++;
        else if (board[r][c] === null) empty++;
      }
      if (mine === line.length - 1 && empty === 1) count++;
    }
    // Row/column
    for (let i = 0; i < 5; i++) {
      let rm = 0, re = 0, cm = 0, ce = 0;
      for (let j = 0; j < 5; j++) {
        if (board[i][j] === color) rm++; else if (board[i][j] === null) re++;
        if (board[j][i] === color) cm++; else if (board[j][i] === null) ce++;
      }
      if (rm === 4 && re === 1) count++;
      if (cm === 4 && ce === 1) count++;
    }
    // Square
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        let m = 0, e = 0;
        for (const [dr, dc] of [[0,0],[0,1],[1,0],[1,1]]) {
          if (board[r+dr][c+dc] === color) m++;
          else if (board[r+dr][c+dc] === null) e++;
        }
        if (m === 3 && e === 1) count++;
      }
    return count;
  }

  // Simulate pinch after a move: detect new formations, greedily remove best opponent targets
  // prevFormations: formations of `color` BEFORE the move was applied
  // Mutates board in-place. Returns number of pinches applied.
  function simulatePinch(board, color, phase, prevFormations) {
    const o = opp(color);
    const newF = Formation.findNew(board, color, prevFormations);
    if (newF.length === 0) return 0;
    for (let i = 0; i < newF.length; i++) {
      const targets = Formation.pinchTargets(board, o);
      if (targets.length === 0) break;
      // Greedy: pick target that maximizes eval for color
      let best = 0;
      if (targets.length > 1) {
        let bestScore = -Infinity;
        for (let t = 0; t < targets.length; t++) {
          const [r, c] = targets[t];
          const saved = board[r][c];
          board[r][c] = phase === 1 ? 'D' + o : null;
          const s = evaluate(board, color, phase);
          board[r][c] = saved;
          if (s > bestScore) { bestScore = s; best = t; }
        }
      }
      const [r, c] = targets[best];
      board[r][c] = phase === 1 ? 'D' + o : null;
    }
    return newF.length;
  }

  return { evaluate, countThreats, opp, simulatePinch };
})();
