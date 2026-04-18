// Formation detection for 5x5 Strategy Game
// All diagonal formations require both endpoints on board edge (row or col is 0 or 4)

const Formation = (() => {
  const SIZE = 5;
  const isEdge = v => v === 0 || v === SIZE - 1;

  // Pre-compute all valid diagonal lines (length 3-5) with both endpoints on edge
  const DIAG_LINES = (() => {
    const lines = [];
    const dirs = [[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          // Walk from (r,c) in direction (dr,dc), collect all cells
          const all = [];
          let nr = r, nc = c;
          while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
            all.push([nr, nc]);
            nr += dr; nc += dc;
          }
          // Extract all sub-lines of length 3, 4, 5 where both endpoints are on edge
          for (let len = 3; len <= Math.min(5, all.length); len++) {
            for (let start = 0; start <= all.length - len; start++) {
              const sub = all.slice(start, start + len);
              const [sr, sc] = sub[0];
              const [er, ec] = sub[sub.length - 1];
              if ((isEdge(sr) || isEdge(sc)) && (isEdge(er) || isEdge(ec))) {
                lines.push(sub);
              }
            }
          }
        }
      }
    }
    // Deduplicate by sorting cells and creating key
    const seen = new Set();
    return lines.filter(line => {
      const key = line.map(c => c.join(',')).sort().join(';');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  function findAll(board, color) {
    const results = [];

    // 1. 大棍 (5 in a row/column spanning full board)
    for (let r = 0; r < SIZE; r++) {
      if (board[r].every(cell => cell === color))
        results.push({ type: 'line5', cells: Array.from({length: 5}, (_, c) => [r, c]) });
    }
    for (let c = 0; c < SIZE; c++) {
      if (Array.from({length: 5}, (_, r) => board[r][c]).every(v => v === color))
        results.push({ type: 'line5', cells: Array.from({length: 5}, (_, r) => [r, c]) });
    }

    // 2. Diagonal formations from pre-computed lines
    for (const line of DIAG_LINES) {
      if (line.every(([r, c]) => board[r][c] === color)) {
        const type = line.length === 5 ? 'diag5' : line.length === 4 ? 'diag4' : 'diag3';
        results.push({ type, cells: [...line] });
      }
    }

    // 3. 方 (2x2 square)
    for (let r = 0; r < SIZE - 1; r++) {
      for (let c = 0; c < SIZE - 1; c++) {
        if (board[r][c] === color && board[r][c+1] === color &&
            board[r+1][c] === color && board[r+1][c+1] === color) {
          results.push({ type: 'square', cells: [[r,c],[r,c+1],[r+1,c],[r+1,c+1]] });
        }
      }
    }

    return results;
  }

  function formationKey(f) {
    return f.type + ':' + f.cells.map(c => c.join(',')).sort().join(';');
  }

  function findNew(board, color, prevFormations) {
    const all = findAll(board, color);
    const prevKeys = new Set(prevFormations.map(formationKey));
    return all.filter(f => !prevKeys.has(formationKey(f)));
  }

  function pinchCount(formations) {
    return formations.length; // each formation grants 1 pinch
  }

  function pinchTargets(board, opponentColor) {
    const formations = findAll(board, opponentColor);
    const inFormation = new Set();
    for (const f of formations)
      for (const [r, c] of f.cells) inFormation.add(r + ',' + c);

    const free = [], all = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] === opponentColor) {
          all.push([r, c]);
          if (!inFormation.has(r + ',' + c)) free.push([r, c]);
        }
    return free.length > 0 ? free : all;
  }

  return { findAll, findNew, pinchCount, pinchTargets, DIAG_LINES, SIZE };
})();

if (typeof module !== 'undefined') module.exports = Formation;
