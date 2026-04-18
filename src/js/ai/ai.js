// AI Factory - unified interface for all AI levels
const AI = (() => {
  const engines = {
    random: AIRandom,
    greedy: AIGreedy,
    minimax: AIMinimax,
    mcts: AIMCTS,
    negamax: AINegamax,
  };

  function get(level) { return engines[level] || engines.random; }

  function list() {
    return [
      { id: 'random',  name: '随机 (Random)',  desc: 'Beginner' },
      { id: 'greedy',  name: '贪心 (Greedy)',   desc: 'Intermediate' },
      { id: 'minimax', name: '极小极大 (Minimax)', desc: 'Advanced' },
      { id: 'mcts',    name: '蒙特卡洛 (MCTS)',  desc: 'Expert' },
      { id: 'negamax', name: '深度搜索 (Negamax)', desc: 'Master' },
    ];
  }

  function shouldClaimPinch(g) {
    return g.newFormations && g.newFormations.length > 0;
  }

  return { get, list, shouldClaimPinch };
})();
