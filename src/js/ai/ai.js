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
      { id: 'random',  name: '初级',  desc: 'Beginner' },
      { id: 'greedy',  name: '中级',   desc: 'Intermediate' },
      { id: 'minimax', name: '高级', desc: 'Advanced' },
      { id: 'mcts',    name: '专家',  desc: 'Expert' },
      { id: 'negamax', name: '大师', desc: 'Master' },
    ];
  }

  function shouldClaimPinch(g) {
    return g.newFormations && g.newFormations.length > 0;
  }

  return { get, list, shouldClaimPinch };
})();
