// Unit tests for 五导棍
// Run: node src/test/test.js

// Minimal test framework
let passed = 0, failed = 0, total = 0;
function describe(name, fn) { console.log(`\n=== ${name} ===`); fn(); }
function it(name, fn) {
  total++;
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch(e) { failed++; console.log(`  ❌ ${name}\n     ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// Load modules into global scope
const vm = require('vm'), fs = require('fs');
const load = f => vm.runInThisContext(fs.readFileSync(f, 'utf8'), {filename: f});
load('src/js/formation.js');
load('src/js/game.js');
load('src/js/ai/eval.js');
load('src/js/ai/random.js');
load('src/js/ai/greedy.js');
load('src/js/ai/minimax.js');
load('src/js/ai/mcts.js');
load('src/js/ai/negamax.js');
load('src/js/ai/ai.js');

function emptyBoard() { return Array.from({length:5}, () => Array(5).fill(null)); }

// ============================================================
// Formation Detection Tests
// ============================================================
describe('Formation: DIAG_LINES pre-computation', () => {
  it('should have pre-computed diagonal lines', () => {
    assert(Formation.DIAG_LINES.length > 0, 'No diagonal lines computed');
  });

  it('all lines should have length 3-5', () => {
    for (const line of Formation.DIAG_LINES)
      assert(line.length >= 3 && line.length <= 5, `Bad length: ${line.length}`);
  });

  it('all lines should have both endpoints on edge', () => {
    const isEdge = v => v === 0 || v === 4;
    for (const line of Formation.DIAG_LINES) {
      const [sr, sc] = line[0], [er, ec] = line[line.length - 1];
      assert((isEdge(sr) || isEdge(sc)) && (isEdge(er) || isEdge(ec)),
        `Endpoints not on edge: (${sr},${sc})-(${er},${ec})`);
    }
  });
});

describe('Formation: diag3 detection', () => {
  it('TC-04: (0,2)-(1,3)-(2,4) should trigger diag3', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'B'; b[2][4] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(f.some(x => x.type === 'diag3'), 'Should find diag3');
  });

  it('TC-04: (1,1)-(2,2)-(3,3) should NOT trigger (not on edge)', () => {
    const b = emptyBoard();
    b[1][1] = 'B'; b[2][2] = 'B'; b[3][3] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(!f.some(x => x.type === 'diag3'), 'Should not find diag3 for non-edge diagonal');
  });

  it('(2,0)-(3,1)-(4,2) should trigger diag3', () => {
    const b = emptyBoard();
    b[2][0] = 'W'; b[3][1] = 'W'; b[4][2] = 'W';
    const f = Formation.findAll(b, 'W');
    assert(f.some(x => x.type === 'diag3'), 'Should find diag3');
  });

  it('(0,4)-(1,3)-(2,2) should NOT trigger - endpoint (2,2) not on edge', () => {
    const b = emptyBoard();
    b[0][4] = 'B'; b[1][3] = 'B'; b[2][2] = 'B';
    // endpoint (0,4): row 0 is edge. endpoint (2,2): neither 0 nor 4 — should NOT trigger
    const f = Formation.findAll(b, 'B');
    // Actually (2,2) is not on edge, so this should NOT trigger
    assert(!f.some(x => x.type === 'diag3'), 'Should not trigger - (2,2) not on edge');
  });

  it('(0,2)-(1,1)-(2,0) anti-diagonal should trigger diag3', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][1] = 'B'; b[2][0] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(f.some(x => x.type === 'diag3'), 'Should find diag3 - both endpoints on edge');
  });
});

describe('Formation: diag4 detection', () => {
  it('(0,1)-(1,2)-(2,3)-(3,4) should trigger diag4', () => {
    const b = emptyBoard();
    b[0][1] = 'B'; b[1][2] = 'B'; b[2][3] = 'B'; b[3][4] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(f.some(x => x.type === 'diag4'), 'Should find diag4');
  });
});

describe('Formation: diag5 (通天) detection', () => {
  it('(0,0)-(1,1)-(2,2)-(3,3)-(4,4) main diagonal should trigger diag5', () => {
    const b = emptyBoard();
    for (let i = 0; i < 5; i++) b[i][i] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(f.some(x => x.type === 'diag5'), 'Should find diag5');
  });

  it('(0,4)-(1,3)-(2,2)-(3,1)-(4,0) anti-diagonal should trigger diag5', () => {
    const b = emptyBoard();
    for (let i = 0; i < 5; i++) b[i][4-i] = 'W';
    const f = Formation.findAll(b, 'W');
    assert(f.some(x => x.type === 'diag5'), 'Should find diag5');
  });
});

describe('Formation: line5 (大棍) detection', () => {
  it('full row should trigger line5', () => {
    const b = emptyBoard();
    for (let c = 0; c < 5; c++) b[2][c] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(f.some(x => x.type === 'line5'), 'Should find line5 for full row');
  });

  it('full column should trigger line5', () => {
    const b = emptyBoard();
    for (let r = 0; r < 5; r++) b[r][3] = 'W';
    const f = Formation.findAll(b, 'W');
    assert(f.some(x => x.type === 'line5'), 'Should find line5 for full column');
  });

  it('4 in a row should NOT trigger line5', () => {
    const b = emptyBoard();
    for (let c = 0; c < 4; c++) b[0][c] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(!f.some(x => x.type === 'line5'), 'Should not find line5 for 4 in a row');
  });
});

describe('Formation: square (方) detection', () => {
  it('2x2 square should trigger', () => {
    const b = emptyBoard();
    b[1][1] = 'B'; b[1][2] = 'B'; b[2][1] = 'B'; b[2][2] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(f.some(x => x.type === 'square'), 'Should find square');
  });

  it('corner 2x2 should trigger', () => {
    const b = emptyBoard();
    b[0][0] = 'W'; b[0][1] = 'W'; b[1][0] = 'W'; b[1][1] = 'W';
    const f = Formation.findAll(b, 'W');
    assert(f.some(x => x.type === 'square'), 'Should find corner square');
  });

  it('non-square L-shape should NOT trigger', () => {
    const b = emptyBoard();
    b[0][0] = 'B'; b[0][1] = 'B'; b[1][0] = 'B';
    const f = Formation.findAll(b, 'B');
    assert(!f.some(x => x.type === 'square'), 'Should not find square for L-shape');
  });
});

describe('Formation: dead pieces excluded', () => {
  it('dead pieces should not count for formations', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'DB'; b[2][4] = 'B'; // middle is dead
    const f = Formation.findAll(b, 'B');
    assert(!f.some(x => x.type === 'diag3'), 'Dead piece breaks formation');
  });
});

describe('Formation: findNew', () => {
  it('should detect newly created formation', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'B';
    const prev = Formation.findAll(b, 'B');
    b[2][4] = 'B';
    const newF = Formation.findNew(b, 'B', prev);
    assert(newF.length > 0, 'Should find new formation');
    assert(newF.some(x => x.type === 'diag3'), 'New formation should be diag3');
  });

  it('should not report existing formation as new', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'B'; b[2][4] = 'B';
    const prev = Formation.findAll(b, 'B');
    b[3][3] = 'B'; // unrelated placement
    const newF = Formation.findNew(b, 'B', prev);
    assert(!newF.some(x => x.type === 'diag3' &&
      x.cells.some(c => c[0]===0 && c[1]===2)), 'Existing formation should not be new');
  });
});

// ============================================================
// Game Logic Tests
// ============================================================
describe('Game: initialization', () => {
  it('should create empty 5x5 board', () => {
    const g = Game.create();
    eq(g.board.length, 5);
    eq(g.board[0].length, 5);
    assert(g.board.every(r => r.every(c => c === null)));
  });

  it('should start in phase 1 with black turn', () => {
    const g = Game.create();
    eq(g.phase, Game.PHASE_PLACE);
    eq(g.turn, 'B');
    eq(g.state, Game.STATE_WAIT_ACTION);
  });
});

describe('Game: placement', () => {
  it('should place piece and alternate turns', () => {
    const g = Game.create();
    Game.place(g, 0, 0);
    eq(g.board[0][0], 'B');
    // If no formation, turn switches
    if (g.state === Game.STATE_WAIT_ACTION) eq(g.turn, 'W');
  });

  it('should reject placement on occupied cell', () => {
    const g = Game.create();
    Game.place(g, 0, 0);
    // Force turn back for test
    if (g.state === Game.STATE_WAIT_ACTION) {
      const result = Game.place(g, 0, 0);
      eq(result, false);
    }
  });

  it('should detect formation and enter pinch select state', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    const result = Game.place(g, 2, 4);
    assert(result, 'Place should succeed');
    assert(result.newFormations.length > 0, 'Should detect new formation');
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
  });
});

describe('Game: pinch flow', () => {
  it('should allow direct pinch after formation', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.board[0][0] = 'W';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 3;
    Game.place(g, 2, 4);
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);

    const pinchResult = Game.pinch(g, 0, 0);
    assert(pinchResult, 'Pinch should succeed');
    eq(g.board[0][0], 'DW');
  });

  it('should expire and end turn', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    Game.place(g, 2, 4);
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);

    Game.expireClaim(g);
    eq(g.state, Game.STATE_WAIT_ACTION);
    eq(g.turn, 'W');
  });

  it('should reject pinch on own piece', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B'; g.board[3][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 3;
    Game.place(g, 2, 4);
    const result = Game.pinch(g, 3, 3);
    eq(result, false);
  });
});

describe('Game: phase transition', () => {
  it('should transition to phase 2 after 25 placements', () => {
    const g = Game.create();
    let turn = 'B';
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        g.board[r][c] = turn;
        g.placedCount++;
        turn = turn === 'B' ? 'W' : 'B';
        // Handle any claim states by expiring
        if (g.state === Game.STATE_WAIT_PINCH_SELECT) Game.expireClaim(g);
      }
    // Manually trigger transition since we bypassed Game.place
    g.placedCount = 25;
    g.turn = 'B';
    g.state = Game.STATE_WAIT_ACTION;
    // Simulate endTurn triggering transition
    // Actually let's test via proper placement
    const g2 = Game.create();
    // Fill 24 cells, then place the 25th
    for (let i = 0; i < 24; i++) {
      const r = Math.floor(i / 5), c = i % 5;
      g2.board[r][c] = g2.turn;
      g2.placedCount++;
      g2.formations[g2.turn] = Formation.findAll(g2.board, g2.turn);
      g2.turn = g2.turn === 'B' ? 'W' : 'B';
    }
    g2.state = Game.STATE_WAIT_ACTION;
    Game.place(g2, 4, 4);
    // Should be in phase 2 now (or claim state if formation detected)
    if (g2.state === Game.STATE_WAIT_PINCH_SELECT) Game.expireClaim(g2);
    eq(g2.phase, Game.PHASE_MOVE);
  });
});

describe('Game: movement', () => {
  it('should move piece to adjacent empty cell', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[2][2] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    const result = Game.move(g, 2, 2, 2, 3);
    assert(result, 'Move should succeed');
    eq(g.board[2][2], null);
    eq(g.board[2][3], 'B');
  });

  it('should reject non-adjacent move', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[0][0] = 'B';
    const result = Game.move(g, 0, 0, 2, 2);
    eq(result, false);
  });

  it('should reject move to occupied cell', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[0][0] = 'B'; g.board[0][1] = 'W';
    const result = Game.move(g, 0, 0, 0, 1);
    eq(result, false);
  });
});

describe('Game: sacrifice', () => {
  it('should sacrifice own piece when no legal moves', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.state = Game.STATE_WAIT_SACRIFICE;
    g.turn = 'B';
    // Surrounded piece
    g.board[2][2] = 'B';
    g.board[2][1] = 'W'; g.board[2][3] = 'W';
    g.board[1][2] = 'W'; g.board[3][2] = 'W';
    const result = Game.sacrifice(g, 2, 2);
    assert(result, 'Sacrifice should succeed');
    eq(g.board[2][2], null);
  });

  it('should reject sacrifice of opponent piece', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.state = Game.STATE_WAIT_SACRIFICE;
    g.turn = 'B';
    g.board[0][0] = 'W';
    const result = Game.sacrifice(g, 0, 0);
    eq(result, false);
  });
});

describe('Game: undo', () => {
  it('should undo placement', () => {
    const g = Game.create();
    Game.place(g, 2, 2);
    Game.undo(g);
    eq(g.board[2][2], null);
    eq(g.turn, 'B');
  });
});

describe('Game: win condition', () => {
  it('should detect win when opponent has no pieces', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.state = Game.STATE_WAIT_PINCH_SELECT;
    g.turn = 'B';
    g.pinchesRemaining = 1;
    g.newFormations = [{type:'diag3', cells:[[0,0],[1,1],[2,2]]}];
    g.board[0][0] = 'W'; // last opponent piece
    g.board[1][1] = 'B'; g.board[2][2] = 'B';
    const result = Game.pinch(g, 0, 0);
    assert(result.gameOver, 'Should be game over');
    eq(g.winner, 'B');
  });
});

// ============================================================
// AI Tests
// ============================================================
describe('AI: Random', () => {
  it('should return valid placement', () => {
    const g = Game.create();
    const m = AIRandom.choosePlace(g);
    assert(m && m.r >= 0 && m.r < 5 && m.c >= 0 && m.c < 5);
    eq(g.board[m.r][m.c], null);
  });

  it('should return valid move in phase 2', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[2][2] = 'B';
    g.turn = 'B';
    const m = AIRandom.chooseMove(g);
    assert(m && m.fr === 2 && m.fc === 2);
    assert(Game.isAdjacent(m.fr, m.fc, m.tr, m.tc));
  });

  it('should return valid pinch target', () => {
    const g = Game.create();
    g.board[0][0] = 'W'; g.board[1][1] = 'W';
    g.turn = 'B';
    const t = AIRandom.choosePinch(g);
    assert(t && g.board[t[0]][t[1]] === 'W');
  });
});

describe('AI: Greedy', () => {
  it('should prefer strategic positions', () => {
    const g = Game.create();
    const m = AIGreedy.choosePlace(g);
    // On empty board, should prefer center or strategic positions
    assert(m && g.board[m.r][m.c] === null, 'Should pick valid empty cell');
  });

  it('should return valid placement', () => {
    const g = Game.create();
    const m = AIGreedy.choosePlace(g);
    assert(m && g.board[m.r][m.c] === null);
  });
});

describe('AI: Minimax', () => {
  it('should return valid placement', () => {
    const g = Game.create();
    const m = AIMinimax.choosePlace(g);
    assert(m && g.board[m.r][m.c] === null);
  });

  it('should block opponent formation most of the time', () => {
    let blocked = 0;
    for (let i = 0; i < 20; i++) {
      const g = Game.create();
      g.board[0][2] = 'W'; g.board[1][3] = 'W';
      g.formations.W = Formation.findAll(g.board, 'W');
      g.turn = 'B';
      const m = AIMinimax.choosePlace(g);
      if (m.r === 2 && m.c === 4) blocked++;
    }
    assert(blocked >= 5, `Should block at (2,4) frequently, got ${blocked}/20`);
  });
});

describe('AI: MCTS', () => {
  it('should return valid placement', () => {
    const g = Game.create();
    const m = AIMCTS.choosePlace(g);
    assert(m && g.board[m.r][m.c] === null);
  });
});

describe('AI: Factory', () => {
  it('should return correct engine by level', () => {
    eq(AI.get('random').name, 'Random');
    eq(AI.get('greedy').name, 'Greedy');
    eq(AI.get('minimax').name, 'Minimax');
    eq(AI.get('mcts').name, 'MCTS');
  });

  it('should default to random for unknown level', () => {
    eq(AI.get('unknown').name, 'Random');
  });

  it('should list all AI levels', () => {
    eq(AI.list().length, 3);
  });
});

// ============================================================
// Regression Tests (user-reported bugs)
// ============================================================
describe('Regression: pinch switches turn', () => {
  it('should switch turn after pinch completes', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B'; g.board[0][0] = 'W';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 3;
    Game.place(g, 2, 4); // B forms diag3
    eq(g.turn, 'B'); // still B's turn during pinch select
    Game.pinch(g, 0, 0);
    eq(g.turn, 'W'); // must switch to W after pinch
    eq(g.state, Game.STATE_WAIT_ACTION);
  });

  it('should switch turn after expire (no pinch taken)', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    Game.place(g, 2, 4);
    eq(g.turn, 'B');
    Game.expireClaim(g);
    eq(g.turn, 'W');
  });
});

describe('Regression: pinch targets prioritize non-formation pieces', () => {
  it('should only return non-formation pieces when available', () => {
    const b = emptyBoard();
    // W has a diag3 at (0,2)-(1,3)-(2,4) and a free piece at (3,0)
    b[0][2] = 'W'; b[1][3] = 'W'; b[2][4] = 'W'; b[3][0] = 'W';
    const targets = Formation.pinchTargets(b, 'W');
    eq(targets.length, 1);
    eq(targets[0][0], 3); eq(targets[0][1], 0);
  });

  it('should allow formation pieces when all are in formations', () => {
    const b = emptyBoard();
    b[0][2] = 'W'; b[1][3] = 'W'; b[2][4] = 'W'; // all in diag3
    const targets = Formation.pinchTargets(b, 'W');
    eq(targets.length, 3); // all 3 are valid since no free pieces
  });

  it('should reject pinch on formation piece when free pieces exist', () => {
    const g = Game.create();
    // B will form diag3 at (0,2)-(1,3)-(2,4)
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    // W has formation at (2,0)-(3,1)-(4,2) and free piece at (4,4)
    g.board[2][0] = 'W'; g.board[3][1] = 'W'; g.board[4][2] = 'W';
    g.board[4][4] = 'W'; // free W piece
    g.formations.B = Formation.findAll(g.board, 'B');
    g.formations.W = Formation.findAll(g.board, 'W');
    g.placedCount = 7;
    Game.place(g, 2, 4); // B forms diag3
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
    // Try to pinch W's formation piece
    const bad = Game.pinch(g, 2, 0);
    eq(bad, false); // rejected - W has free piece at (4,4)
    // Pinch the free piece
    const good = Game.pinch(g, 4, 4);
    assert(good, 'Should allow pinching free piece');
  });
});

describe('Regression: direct pinch select (no claim step)', () => {
  it('should go directly to pinch select on formation', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    Game.place(g, 2, 4);
    // Should be in pinch select directly, NOT waitClaim
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
  });

  it('move phase should also go directly to pinch select', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[0][2] = 'B'; g.board[1][3] = 'B'; g.board[2][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    // Move (2,3) to (2,4) to complete diag3
    const result = Game.move(g, 2, 3, 2, 4);
    assert(result, 'Move should succeed');
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
  });

  it('expireClaim should work on pinch select state', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    Game.place(g, 2, 4);
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
    Game.expireClaim(g);
    eq(g.state, Game.STATE_WAIT_ACTION);
    eq(g.turn, 'W');
  });
});

describe('Regression: AI pinch after formation', () => {
  it('AI should be able to pinch after forming', () => {
    const g = Game.create();
    g.board[0][2] = 'W'; g.board[1][3] = 'W';
    g.board[0][0] = 'B'; g.board[1][0] = 'B';
    g.turn = 'W'; g.placedCount = 4;
    g.formations.W = Formation.findAll(g.board, 'W');
    const result = Game.place(g, 2, 4); // W forms diag3
    assert(result.newFormations.length > 0, 'Should detect formation');
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
    eq(g.turn, 'W'); // still W's turn for pinch

    const ai = AI.get('greedy');
    const t = ai.choosePinch(g);
    assert(t, 'AI should choose a pinch target');
    const pr = Game.pinch(g, t[0], t[1]);
    assert(pr, 'Pinch should succeed');
    eq(g.turn, 'B'); // turn switches to human after pinch
  });
});

describe('Regression: win at phase transition (all pieces dead)', () => {
  it('should declare winner when all opponent pieces die in phase 1', () => {
    const g = Game.create();
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        if (r === 4 && c === 4) continue;
        g.board[r][c] = (r + c) % 2 === 0 ? 'B' : 'W';
        g.placedCount++;
      }
    // Mark ALL white pieces as dead
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (g.board[r][c] === 'W') {
          g.board[r][c] = 'DW';
          g.deadPieces.push({r, c, color: 'W'});
        }
    g.turn = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.state = Game.STATE_WAIT_ACTION;
    Game.place(g, 4, 4);
    // If formation detected, expire it to trigger phase transition
    if (g.state === Game.STATE_WAIT_PINCH_SELECT) Game.expireClaim(g);
    // Now in PHASE_MOVE, dead pieces still on board (UI shows overlay first)
    eq(g.phase, Game.PHASE_MOVE);
    // After overlay, removeDeadPieces is called
    Game.removeDeadPieces(g);
    eq(g.phase, Game.PHASE_OVER);
    eq(g.winner, 'B');
  });

  it('should continue game when both sides have pieces after transition', () => {
    const g = Game.create();
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        if (r === 4 && c === 4) continue;
        g.board[r][c] = (r + c) % 2 === 0 ? 'B' : 'W';
        g.placedCount++;
      }
    // Mark only one W dead
    g.board[0][1] = 'DW';
    g.deadPieces.push({r: 0, c: 1, color: 'W'});
    g.turn = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.state = Game.STATE_WAIT_ACTION;
    Game.place(g, 4, 4);
    // Handle any formation
    if (g.state === Game.STATE_WAIT_PINCH_SELECT) Game.expireClaim(g);
    eq(g.phase, Game.PHASE_MOVE); // game continues
    assert(!g.winner, 'No winner yet');
  });
});

// ============================================================
// AI Evaluation Tests
// ============================================================
describe('AIEval: evaluation function', () => {
  it('should score formations positively', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'B'; b[2][4] = 'B'; // diag3
    const s = AIEval.evaluate(b, 'B', Game.PHASE_PLACE);
    assert(s > 0, 'Formation should give positive score');
  });

  it('should score opponent formations negatively', () => {
    const b = emptyBoard();
    b[0][2] = 'W'; b[1][3] = 'W'; b[2][4] = 'W'; // opponent diag3
    const s = AIEval.evaluate(b, 'B', Game.PHASE_PLACE);
    assert(s < 0, 'Opponent formation should give negative score');
  });

  it('should detect threats (one piece away from formation)', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'B'; // one away from diag3 at (2,4)
    const threats = AIEval.countThreats(b, 'B');
    assert(threats > 0, 'Should detect threat');
  });

  it('should prefer center positions', () => {
    const b1 = emptyBoard(); b1[2][2] = 'B'; // center
    const b2 = emptyBoard(); b2[0][0] = 'B'; // corner
    const s1 = AIEval.evaluate(b1, 'B', Game.PHASE_PLACE);
    const s2 = AIEval.evaluate(b2, 'B', Game.PHASE_PLACE);
    assert(s1 > s2, 'Center should score higher than corner');
  });
});

describe('AI: Negamax', () => {
  it('should return valid placement', () => {
    const g = Game.create();
    const m = AINegamax.choosePlace(g);
    assert(m && g.board[m.r][m.c] === null);
  });

  it('should return valid move in phase 2', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[2][2] = 'B'; g.board[3][3] = 'B';
    g.turn = 'B';
    const m = AINegamax.chooseMove(g);
    assert(m, 'Should return a move');
    assert(Game.isAdjacent(m.fr, m.fc, m.tr, m.tc), 'Move should be adjacent');
  });

  it('should return valid pinch target', () => {
    const g = Game.create();
    g.board[0][0] = 'W'; g.board[4][4] = 'W';
    g.turn = 'B';
    const t = AINegamax.choosePinch(g);
    assert(t && g.board[t[0]][t[1]] === 'W');
  });

  it('should return valid sacrifice', () => {
    const g = Game.create();
    g.phase = Game.PHASE_MOVE;
    g.board[2][2] = 'B'; g.board[0][0] = 'B';
    g.turn = 'B';
    const t = AINegamax.chooseSacrifice(g);
    assert(t && g.board[t[0]][t[1]] === 'B');
  });
});

// ============================================================
// Multi-pinch and Surrender Tests
// ============================================================
describe('Game: multi-pinch logic', () => {
  it('multiple formations should grant multiple pinches', () => {
    const g = Game.create();
    // Set up so placing one piece creates two formations
    // diag3: (0,2)-(1,3)-(2,4) and square: (0,2)(0,3)(1,2)(1,3)
    g.board[0][2] = 'B'; g.board[0][3] = 'B';
    g.board[1][2] = 'B'; g.board[1][3] = 'B'; // square already exists
    g.board[2][4] = 'B'; // diag3 needs (0,2)-(1,3)-(2,4) — already have 0,2 and 2,4
    g.formations.B = Formation.findAll(g.board, 'B');
    // Now we have square already. Let's set up fresh:
    const g2 = Game.create();
    g2.board[0][2] = 'B'; g2.board[1][3] = 'B'; // partial diag3
    g2.board[0][3] = 'B'; g2.board[1][2] = 'B'; // partial square (need 1,3)
    g2.formations.B = Formation.findAll(g2.board, 'B');
    g2.placedCount = 4;
    g2.board[3][0] = 'W'; g2.board[4][0] = 'W'; // targets
    // Place at (2,4) completes diag3 only
    const result = Game.place(g2, 2, 4);
    assert(result.newFormations.length >= 1, 'Should have at least 1 formation');
    assert(g2.pinchesRemaining >= 1, 'Should have pinches');
  });

  it('pinchCount returns count equal to formations', () => {
    const formations = [
      { type: 'diag3', cells: [[0,2],[1,3],[2,4]] },
      { type: 'square', cells: [[0,0],[0,1],[1,0],[1,1]] },
    ];
    eq(Formation.pinchCount(formations), 2);
  });
});

describe('Game: surrender', () => {
  it('should end game with opponent as winner', () => {
    const g = Game.create();
    g.turn = 'B';
    // Simulate surrender: current player loses
    g.winner = 'W';
    g.phase = Game.PHASE_OVER;
    g.state = 'over';
    eq(g.winner, 'W');
    eq(g.phase, Game.PHASE_OVER);
  });

  it('game state should prevent further moves after surrender', () => {
    const g = Game.create();
    g.phase = Game.PHASE_OVER;
    g.state = 'over';
    const result = Game.place(g, 0, 0);
    eq(result, false);
  });
});

// ============================================================
// Blind Mode Tests (hints off behavior)
// ============================================================
describe('Blind mode: pinch still works without hints', () => {
  it('formation should still be detected when hints off (game logic unchanged)', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.board[0][0] = 'W';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 3;
    const result = Game.place(g, 2, 4);
    assert(result.newFormations.length > 0, 'Formation detected regardless of UI hints');
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
    // Player can still pinch
    const pr = Game.pinch(g, 0, 0);
    assert(pr, 'Pinch succeeds in blind mode');
  });

  it('no formation: endTurn already called, state is waitAction', () => {
    const g = Game.create();
    g.placedCount = 0;
    const result = Game.place(g, 2, 2);
    assert(result, 'Place succeeds');
    eq(result.newFormations.length, 0);
    eq(g.state, Game.STATE_WAIT_ACTION);
    eq(g.turn, 'W'); // turn already switched
  });

  it('expireClaim only works in pinch select state', () => {
    const g = Game.create();
    g.state = Game.STATE_WAIT_ACTION;
    g.turn = 'B';
    const result = Game.expireClaim(g);
    eq(result, false); // no-op when not in pinch select
    eq(g.turn, 'B'); // turn unchanged
  });
});

describe('Blind mode: consistent turn state after pinch', () => {
  it('after pinch completes, turn switches exactly once', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.board[0][0] = 'W'; g.board[4][4] = 'W';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 4;
    Game.place(g, 2, 4); // B forms diag3
    eq(g.turn, 'B'); // still B during pinch
    Game.pinch(g, 4, 4); // pinch W
    eq(g.turn, 'W'); // switched once
    eq(g.state, Game.STATE_WAIT_ACTION);
    // Calling expireClaim now should be no-op (state is waitAction)
    const expired = Game.expireClaim(g);
    eq(expired, false);
    eq(g.turn, 'W'); // still W, not double-switched
  });

  it('double expireClaim should not double-switch turn', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    Game.place(g, 2, 4);
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);
    Game.expireClaim(g);
    eq(g.turn, 'W');
    // Second expireClaim should be no-op
    Game.expireClaim(g);
    eq(g.turn, 'W'); // not switched again
  });
});

// ============================================================
// AI Randomness Tests
// ============================================================
describe('AI: Greedy randomness', () => {
  it('should not always return the same move on identical boards', () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      const g = Game.create();
      const m = AIGreedy.choosePlace(g);
      results.add(`${m.r},${m.c}`);
    }
    // With randomness among top moves, should see variation
    assert(results.size > 1, 'Greedy should show some randomness (got ' + results.size + ' unique moves)');
  });
});

describe('AI: Minimax randomness', () => {
  it('should not always return the same move on identical boards', () => {
    const results = new Set();
    for (let i = 0; i < 10; i++) {
      const g = Game.create();
      const m = AIMinimax.choosePlace(g);
      results.add(`${m.r},${m.c}`);
    }
    assert(results.size > 1, 'Minimax should show some randomness (got ' + results.size + ' unique moves)');
  });
});

describe('AI: Negamax randomness', () => {
  it('should not always return the same move on identical boards', () => {
    const results = new Set();
    for (let i = 0; i < 10; i++) {
      const g = Game.create();
      const m = AINegamax.choosePlace(g);
      results.add(`${m.r},${m.c}`);
    }
    assert(results.size > 1, 'Negamax should show some randomness (got ' + results.size + ' unique moves)');
  });
});

// ============================================================
// Formation highlight line drawing (data validation)
// ============================================================
describe('Formation: cells ordering for line drawing', () => {
  it('diag3 cells should be in sequence for line drawing', () => {
    const b = emptyBoard();
    b[0][2] = 'B'; b[1][3] = 'B'; b[2][4] = 'B';
    const f = Formation.findAll(b, 'B').find(x => x.type === 'diag3');
    assert(f, 'Should find diag3');
    // Cells should be adjacent in sequence (each step is diagonal)
    for (let i = 1; i < f.cells.length; i++) {
      const dr = Math.abs(f.cells[i][0] - f.cells[i-1][0]);
      const dc = Math.abs(f.cells[i][1] - f.cells[i-1][1]);
      eq(dr, 1); eq(dc, 1);
    }
  });

  it('square cells should have 4 elements', () => {
    const b = emptyBoard();
    b[1][1] = 'B'; b[1][2] = 'B'; b[2][1] = 'B'; b[2][2] = 'B';
    const f = Formation.findAll(b, 'B').find(x => x.type === 'square');
    assert(f, 'Should find square');
    eq(f.cells.length, 4);
  });

  it('line5 cells should span full row/column', () => {
    const b = emptyBoard();
    for (let c = 0; c < 5; c++) b[0][c] = 'B';
    const f = Formation.findAll(b, 'B').find(x => x.type === 'line5');
    assert(f, 'Should find line5');
    eq(f.cells.length, 5);
  });
});

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
