// Formation detection for 5x5 Strategy Game
// All diagonal formations require both endpoints on board edge (index 0 or 4)

const Formation = (() => {
  const SIZE = 5;
  const EDGE = [0, 4];
  const isEdge = v => v === 0 || v === 4;

  // Check if a cell matches color and is alive
  const match = (board, r, c, color) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE &&
    board[r][c] === color;

  // Collect all formations for a given color on the board
  // board[r][c] = 'B' | 'W' | null | 'DB' | 'DW'
  // alive color = 'B' or 'W', dead = 'DB' or 'DW'
  function findAll(board, color) {
    const results = [];
    // 1. 大棍 (5 in a row/column)
    for (let r = 0; r < SIZE; r++) {
      if (board[r].every(c => c === color))
        results.push({ type: 'line5', cells: Array.from({length: 5}, (_, c) => [r, c]) });
    }
    for (let c = 0; c < SIZE; c++) {
      if (Array.from({length: 5}, (_, r) => board[r][c]).every(v => v === color))
        results.push({ type: 'line5', cells: Array.from({length: 5}, (_, r) => [r, c]) });
    }

    // 2. Diagonal formations (3, 4, 5) - both endpoints must be on edge
    const dirs = [[1, 1], [1, -1]]; // two diagonal directions
    for (const [dr, dc] of dirs) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          // Collect consecutive same-color cells in this direction
          const cells = [];
          let nr = r, nc = c;
          while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === color) {
            cells.push([nr, nc]);
            nr += dr; nc += dc;
          }
          if (cells.length >= 3) {
            const [sr, sc] = cells[0];
            const [er, ec] = cells[cells.length - 1];
            // Both endpoints must be on board edge
            if ((isEdge(sr) || isEdge(sc)) && (isEdge(er) || isEdge(ec))) {
              if (cells.length === 5) results.push({ type: 'diag5', cells: [...cells] });
              else if (cells.length === 4) results.push({ type: 'diag4', cells: [...cells] });
              else if (cells.length === 3) results.push({ type: 'diag3', cells: [...cells] });
              // For length > 3, also report sub-formations? No - longest wins.
            }
          }
        }
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

    return dedup(results);
  }

  // Deduplicate formations with same cells
  function dedup(formations) {
    const seen = new Set();
    return formations.filter(f => {
      const key = f.type + ':' + f.cells.map(c => c.join(',')).sort().join(';');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Find NEW formations created by placing/moving to (row, col)
  function findNew(board, color, prevFormations) {
    const all = findAll(board, color);
    const prevKeys = new Set(prevFormations.map(f =>
      f.type + ':' + f.cells.map(c => c.join(',')).sort().join(';')
    ));
    return all.filter(f => {
      const key = f.type + ':' + f.cells.map(c => c.join(',')).sort().join(';');
      return !prevKeys.has(key);
    });
  }

  // Count pinches earned by formations
  function pinchCount(formations) {
    let count = 0;
    for (const f of formations) {
      if (f.type === 'diag3' || f.type === 'square') count += 1;
      else if (f.type === 'diag4') count += 1;
      else if (f.type === 'diag5' || f.type === 'line5') count += 1;
    }
    return count;
  }

  // Get all legal pinch targets (opponent alive pieces not in any of their formations)
  function pinchTargets(board, opponentColor) {
    const targets = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] === opponentColor) targets.push([r, c]);
    return targets;
  }

  return { findAll, findNew, pinchCount, pinchTargets, SIZE };
})();

if (typeof module !== 'undefined') module.exports = Formation;
