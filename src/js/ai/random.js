// Level 1: Random AI - picks random legal moves
const AIRandom = (() => {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function choosePlace(g) {
    const moves = Game.getLegalMoves(g, g.turn);
    return pick(moves); // {r, c}
  }

  function chooseMove(g) {
    const moves = Game.getLegalMoves(g, g.turn);
    return pick(moves); // {fr, fc, tr, tc}
  }

  function choosePinch(g) {
    const targets = Formation.pinchTargets(g.board, g.turn === 'B' ? 'W' : 'B');
    return pick(targets); // [r, c]
  }

  function chooseSacrifice(g) {
    const own = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (g.board[r][c] === g.turn) own.push([r, c]);
    return pick(own);
  }

  return { choosePlace, chooseMove, choosePinch, chooseSacrifice, name: 'Random' };
})();
