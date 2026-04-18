// AI Factory - unified interface for all AI levels
const AI = (() => {
  const engines = {
    random: AIRandom,
    greedy: AIGreedy,
    minimax: AIMinimax,
    mcts: AIMCTS,
  };

  function get(level) {
    return engines[level] || engines.random;
  }

  function list() {
    return [
      { id: 'random',  name: '随机 (Random)',  desc: 'Beginner - random moves' },
      { id: 'greedy',  name: '贪心 (Greedy)',   desc: 'Intermediate - heuristic evaluation' },
      { id: 'minimax', name: '极小极大 (Minimax)', desc: 'Advanced - alpha-beta pruning' },
      { id: 'mcts',    name: '蒙特卡洛 (MCTS)',  desc: 'Expert - Monte Carlo tree search' },
    ];
  }

  // AI always claims pinch (it knows if it has formations)
  function shouldClaimPinch(g) {
    return g.newFormations && g.newFormations.length > 0;
  }

  return { get, list, shouldClaimPinch };
})();
