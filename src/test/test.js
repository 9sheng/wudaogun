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
load('src/js/ai/random.js');
load('src/js/ai/greedy.js');
load('src/js/ai/minimax.js');
load('src/js/ai/mcts.js');
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

  it('should detect formation and enter claim state', () => {
    const g = Game.create();
    // Manually set up board for a diag3: (0,2)-(1,3)-(2,4)
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    // Place the completing piece
    const result = Game.place(g, 2, 4);
    assert(result, 'Place should succeed');
    assert(result.newFormations.length > 0, 'Should detect new formation');
    eq(g.state, Game.STATE_WAIT_PINCH_CLAIM);
  });
});

describe('Game: pinch flow', () => {
  it('should allow pinch after claim', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.board[0][0] = 'W'; // opponent piece to pinch
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 3;
    Game.place(g, 2, 4); // completes diag3
    eq(g.state, Game.STATE_WAIT_PINCH_CLAIM);

    const claim = Game.claimPinch(g);
    assert(claim.valid, 'Claim should be valid');
    eq(g.state, Game.STATE_WAIT_PINCH_SELECT);

    const pinchResult = Game.pinch(g, 0, 0);
    assert(pinchResult, 'Pinch should succeed');
    eq(g.board[0][0], 'DW'); // marked dead in phase 1
  });

  it('should expire claim and end turn', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 2;
    Game.place(g, 2, 4);
    eq(g.state, Game.STATE_WAIT_PINCH_CLAIM);

    Game.expireClaim(g);
    eq(g.state, Game.STATE_WAIT_ACTION);
    eq(g.turn, 'W'); // turn passed
  });

  it('should reject pinch on own piece', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B'; g.board[3][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.placedCount = 3;
    Game.place(g, 2, 4);
    Game.claimPinch(g);
    const result = Game.pinch(g, 3, 3); // own piece
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
        if (g.state === Game.STATE_WAIT_PINCH_CLAIM) Game.expireClaim(g);
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
    if (g2.state === Game.STATE_WAIT_PINCH_CLAIM) Game.expireClaim(g2);
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
  it('should prefer forming a formation', () => {
    const g = Game.create();
    g.board[0][2] = 'B'; g.board[1][3] = 'B';
    g.formations.B = Formation.findAll(g.board, 'B');
    g.turn = 'B';
    const m = AIGreedy.choosePlace(g);
    // Should pick (2,4) to complete diag3
    eq(m.r, 2); eq(m.c, 4);
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

  it('should block opponent formation', () => {
    const g = Game.create();
    g.board[0][2] = 'W'; g.board[1][3] = 'W';
    g.formations.W = Formation.findAll(g.board, 'W');
    g.turn = 'B';
    const m = AIMinimax.choosePlace(g);
    // Should block at (2,4)
    eq(m.r, 2); eq(m.c, 4);
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
    eq(AI.list().length, 4);
  });
});

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
