import { createBoard, indexOf, boardToString } from '../../board';
import { allCandidates } from '../../candidates';
import { applyEliminations, placeValue, toggleNote } from '../../engine';
import { createHistory, pushMove, undo } from '../../history';
import type { Board, Digit } from '../../types';
import { detectNakedSingle } from '../nakedSingle';
import { detectHiddenSingle } from '../hiddenSingle';
import { detectNakedSubset } from '../nakedSubset';
import { detectHiddenSubset } from '../hiddenSubset';
import { detectPointingPair } from '../pointingPair';
import { detectClaiming } from '../claiming';
import { detectFish } from '../fish';
import { detectXYWing } from '../xyWing';
import { detectXYZWing } from '../xyzWing';
import { detectUniqueRectangle } from '../uniqueRectangle';
import { detectUniqueRectangleType2 } from '../uniqueRectangleType2';
import { detectSimpleColoring } from '../simpleColoring';
import { detectWWing } from '../wWing';
import { detectSkyscraper } from '../skyscraper';
import { detectTwoStringKite } from '../twoStringKite';
import { detectRemotePair } from '../remotePair';
import { detectBug1 } from '../bug1';
import { detectEmptyRectangle } from '../emptyRectangle';
import { detectUniqueRectangleType4 } from '../uniqueRectangleType4';
import { detectAic } from '../aic';
import { solveBoard } from '../bruteForce';
import { findHint } from '../findHint';

/** Build an 81-char givens string from an index -> digit-char map. */
function givens(entries: Record<number, string>): string {
  const arr = new Array(81).fill('.');
  for (const [k, v] of Object.entries(entries)) arr[Number(k)] = v;
  return arr.join('');
}

const EMPTY = '.'.repeat(81);

function cands(board: Board) {
  return allCandidates(board);
}

/**
 * Build a board + candidate map directly from a cell→digits spec. The advanced
 * detectors read positions from the candidate map and gate eliminations on the
 * board's penciled notes, so this lets us isolate one pattern without
 * constraining all 81 cells. Notes are set to match the candidates.
 */
function scenario(spec: Record<number, number[]>): {
  board: Board;
  map: Map<number, Set<Digit>>;
} {
  let board = createBoard(EMPTY);
  const map = new Map<number, Set<Digit>>();
  for (const [k, ds] of Object.entries(spec)) {
    const i = Number(k);
    map.set(i, new Set(ds as Digit[]));
    for (const d of ds) board = toggleNote(board, i, d as Digit, false)!.board;
  }
  return { board, map };
}

describe('detectNakedSingle', () => {
  // Row 0 holds 1-8 in columns 1-8; index 0 can only be 9.
  const board = createBoard(
    givens({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' }),
  );

  it('finds the lone candidate and places it', () => {
    const hint = detectNakedSingle(board, cands(board));
    expect(hint?.technique).toBe('naked_single');
    expect(hint?.action.kind).toBe('place');
    expect(hint?.action.placements).toEqual([{ index: 0, digit: 9 }]);
    // Last step previews the answer as a ghost.
    expect(hint?.steps.at(-1)?.annotations[0].ghost).toBe(9);
  });

  it('does not fire when every cell has options', () => {
    const sparse = createBoard(givens({ 0: '5' }));
    expect(detectNakedSingle(sparse, cands(sparse))).toBeNull();
  });
});

describe('detectHiddenSingle (cross-hatching)', () => {
  // 1s placed so that in box 0, the digit 1 can only land at index 0.
  const board = createBoard(
    givens({
      [indexOf(1, 4)]: '1',
      [indexOf(2, 7)]: '1',
      [indexOf(4, 1)]: '1',
      [indexOf(7, 2)]: '1',
    }),
  );

  it('finds the only cell in the box for the digit', () => {
    const hint = detectHiddenSingle(board, cands(board));
    expect(hint?.technique).toBe('hidden_single');
    expect(hint?.title).toBe('Cross-Hatching in Box');
    expect(hint?.action.placements).toEqual([{ index: 0, digit: 1 }]);
    // Other empty cells in the box are crossed out; the answer is a ghost.
    const reveal = hint!.steps.at(-1)!.annotations;
    expect(reveal[0].ghost).toBe(1);
    expect(reveal[indexOf(1, 0)].cross).toBe(true);
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectHiddenSingle(empty, cands(empty))).toBeNull();
  });
});

describe('detectNakedSubset — pair (size 2)', () => {
  // Row 0: 1-6 in cols 0-5; two 7s placed so (0,7) and (0,8) are both {8,9},
  // leaving (0,6) as {7,8,9}. With 8 and 9 penciled into (0,6), the pair
  // removes them.
  let board = createBoard(
    givens({
      0: '1', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6',
      [indexOf(4, 7)]: '7',
      [indexOf(6, 8)]: '7',
    }),
  );
  for (const d of [8, 9] as Digit[]) {
    board = toggleNote(board, indexOf(0, 6), d, false)!.board;
  }

  it('finds the pair and eliminates its penciled digits from the unit', () => {
    const hint = detectNakedSubset(board, cands(board), 2);
    expect(hint?.technique).toBe('naked_pair');
    expect(hint?.action.kind).toBe('eliminate');
    const elims = hint!.action.eliminations!;
    expect(elims.every((e) => e.index === indexOf(0, 6))).toBe(true);
    expect(elims.map((e) => e.digit).sort()).toEqual([8, 9]);
    // The pair cells highlight their candidates; the target strikes 8 and 9.
    const reveal = hint!.steps.at(-1)!.annotations;
    expect(reveal[indexOf(0, 7)].highlightNotes?.sort()).toEqual([8, 9]);
    expect(reveal[indexOf(0, 6)].strikeNotes?.sort()).toEqual([8, 9]);
  });

  it('fires without notes; applying seeds the target cell and strikes the digits', () => {
    const noNotes = createBoard(
      givens({
        0: '1', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6',
        [indexOf(4, 7)]: '7',
        [indexOf(6, 8)]: '7',
      }),
    );
    // Detectors trust the candidates map alone; visible-change gating lives in
    // findHint's actionChangesBoard, and Apply seeds note-less target cells.
    const hint = detectNakedSubset(noNotes, cands(noNotes), 2);
    expect(hint?.technique).toBe('naked_pair');
    const res = applyEliminations(noNotes, hint!.action.eliminations!, true);
    // (0,6) was {7,8,9}; seeding pencils that in, then 8 and 9 are struck.
    expect([...res!.board[indexOf(0, 6)].notes]).toEqual([7]);
    // One undo restores the cell to note-less.
    const history = pushMove(createHistory(), res!.move);
    const undone = undo(res!.board, history)!;
    expect(undone.board[indexOf(0, 6)].notes.size).toBe(0);
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectNakedSubset(empty, cands(empty), 2)).toBeNull();
  });
});

describe('detectNakedSubset — triple (size 3)', () => {
  // Row 0: 1-5 in cols 0-4; a 6 in box 2 blocks 6 from (0,6),(0,7),(0,8) so
  // those three are exactly {7,8,9}. (0,5) is {6,7,8,9}; with 7 penciled there
  // the triple removes it.
  let board = createBoard(
    givens({
      0: '1', 1: '2', 2: '3', 3: '4', 4: '5',
      [indexOf(1, 6)]: '6',
    }),
  );
  board = toggleNote(board, indexOf(0, 5), 7, false)!.board;

  it('finds three cells sharing three digits and eliminates them', () => {
    const hint = detectNakedSubset(board, cands(board), 3);
    expect(hint?.technique).toBe('naked_triple');
    expect(hint?.action.kind).toBe('eliminate');
    const elims = hint!.action.eliminations!;
    expect(elims).toContainEqual({ index: indexOf(0, 5), digit: 7 });
    expect(elims.every((e) => e.index === indexOf(0, 5))).toBe(true);
  });
});

describe('detectHiddenSubset — pair (size 2)', () => {
  // Box 0: 1-5 given; 8s and 9s placed so that within box 0, digits 8 and 9 can
  // only go in (2,0) and (2,1). Those two cells also carry 6 and 7 as notes,
  // which the hidden pair removes.
  let board = createBoard(
    givens({
      [indexOf(0, 0)]: '1', [indexOf(0, 1)]: '2', [indexOf(0, 2)]: '3',
      [indexOf(1, 0)]: '4', [indexOf(1, 1)]: '5',
      [indexOf(1, 5)]: '8', [indexOf(1, 6)]: '9', // block 8,9 from (1,2)
      [indexOf(5, 2)]: '8', [indexOf(6, 2)]: '9', // block 8,9 from (2,2)
    }),
  );
  for (const cell of [indexOf(2, 0), indexOf(2, 1)]) {
    for (const d of [6, 7, 8, 9] as Digit[]) {
      board = toggleNote(board, cell, d, false)!.board;
    }
  }

  it('confines two digits to two cells and clears the other notes there', () => {
    const hint = detectHiddenSubset(board, cands(board), 2);
    expect(hint?.technique).toBe('hidden_pair');
    expect(hint?.action.kind).toBe('eliminate');
    const elims = hint!.action.eliminations!;
    expect(elims.every((e) => e.digit === 6 || e.digit === 7)).toBe(true);
    expect(
      elims.every((e) => e.index === indexOf(2, 0) || e.index === indexOf(2, 1)),
    ).toBe(true);
  });
});

describe('detectClaiming (box-line reduction)', () => {
  // Row 0 cols 3-8 filled with 1,2,3,5,6,7 → row 0 is missing {4,8,9}, all only
  // possible in box 0 (cols 0-2). 4 penciled into (1,0) is then claimed away.
  let board = createBoard(
    givens({
      [indexOf(0, 3)]: '1', [indexOf(0, 4)]: '2', [indexOf(0, 5)]: '3',
      [indexOf(0, 6)]: '5', [indexOf(0, 7)]: '6', [indexOf(0, 8)]: '7',
    }),
  );
  board = toggleNote(board, indexOf(1, 0), 4, false)!.board;

  it('confines a digit on a line to one box and clears it from the rest of the box', () => {
    const hint = detectClaiming(board, cands(board));
    expect(hint?.technique).toBe('claiming');
    expect(hint?.action.kind).toBe('eliminate');
    const elims = hint!.action.eliminations!;
    expect(elims).toContainEqual({ index: indexOf(1, 0), digit: 4 });
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectClaiming(empty, cands(empty))).toBeNull();
  });
});

describe('detectPointingPair', () => {
  // Box 0 rows 1-2 fully filled (no 4) so digit candidates confine to row 0,
  // which can then be eliminated from the rest of row 0.
  let board = createBoard(
    givens({
      [indexOf(1, 0)]: '5', [indexOf(1, 1)]: '6', [indexOf(1, 2)]: '7',
      [indexOf(2, 0)]: '8', [indexOf(2, 1)]: '9', [indexOf(2, 2)]: '1',
    }),
  );
  // Pencil digit 2 outside the box on row 0 so there is a real note to remove.
  for (const col of [3, 4]) {
    board = toggleNote(board, indexOf(0, col), 2, false)!.board;
  }

  it('confines a digit to one line and eliminates its penciled copies', () => {
    const hint = detectPointingPair(board, cands(board));
    expect(hint?.technique).toBe('pointing_pair');
    expect(hint?.action.kind).toBe('eliminate');
    const elims = hint!.action.eliminations!;
    expect(elims.length).toBeGreaterThan(0);
    expect(elims.every((e) => e.digit === 2)).toBe(true);
    // On row 0, outside box 0.
    expect(elims.every((e) => e.index >= indexOf(0, 3) && e.index <= indexOf(0, 8))).toBe(true);
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectPointingPair(empty, cands(empty))).toBeNull();
  });
});

describe('findHint ordering', () => {
  it('prefers a naked single over a hidden single when both exist', () => {
    const board = createBoard(
      givens({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' }),
    );
    // Both techniques apply (row 0 has a single empty cell)...
    expect(detectHiddenSingle(board, cands(board))).not.toBeNull();
    // ...but findHint returns the easier one.
    expect(findHint(board)?.technique).toBe('naked_single');
  });

  it('returns null only when the board is already solved', () => {
    const solved =
      '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
    expect(findHint(createBoard(solved))).toBeNull();
  });
});

describe('applyEliminations', () => {
  it('removes only noted candidates, is a no-op otherwise, and undoes cleanly', () => {
    let board = createBoard(givens({ 0: '5' }));
    const target = indexOf(0, 1);
    for (const d of [3, 4, 5] as Digit[]) {
      board = toggleNote(board, target, d, false)!.board;
    }

    const res = applyEliminations(board, [
      { index: target, digit: 4 },
      { index: target, digit: 8 }, // not noted — ignored
    ]);
    expect(res).not.toBeNull();
    expect([...res!.board[target].notes].sort()).toEqual([3, 5]);

    // Nothing to remove → no-op.
    expect(applyEliminations(board, [{ index: target, digit: 9 }])).toBeNull();

    // The batched move undoes in one step.
    const history = pushMove(createHistory(), res!.move);
    const undone = undo(res!.board, history)!;
    expect([...undone.board[target].notes].sort()).toEqual([3, 4, 5]);
  });
});

describe('detectFish', () => {
  it('finds an X-Wing and eliminates the digit from the cover columns', () => {
    // 5 sits only in columns 1 and 4 of rows 0 and 3 → X-Wing; a 5 elsewhere in
    // column 1 (row 6) is removed.
    const { board, map } = scenario({
      [indexOf(0, 1)]: [5], [indexOf(0, 4)]: [5],
      [indexOf(3, 1)]: [5], [indexOf(3, 4)]: [5],
      [indexOf(6, 1)]: [5],
    });
    const hint = detectFish(board, map, 2);
    expect(hint?.technique).toBe('x_wing');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(6, 1), digit: 5 });
  });

  it('finds a Swordfish across three rows and columns', () => {
    const { board, map } = scenario({
      [indexOf(0, 1)]: [4], [indexOf(0, 4)]: [4],
      [indexOf(3, 4)]: [4], [indexOf(3, 7)]: [4],
      [indexOf(6, 1)]: [4], [indexOf(6, 7)]: [4],
      [indexOf(1, 4)]: [4], // off the base rows, on a cover column → removed
    });
    const hint = detectFish(board, map, 3);
    expect(hint?.technique).toBe('swordfish');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(1, 4), digit: 4 });
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectFish(empty, cands(empty), 2)).toBeNull();
  });
});

describe('detectXYWing', () => {
  it('finds a pivot + two pincers and removes z from a cell seeing both', () => {
    // pivot {1,2} at (0,0); pincers {1,3} at (0,1) and {2,3} at (1,0); z=3 is
    // removed from (1,1), which sees both pincers.
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2],
      [indexOf(0, 1)]: [1, 3],
      [indexOf(1, 0)]: [2, 3],
      [indexOf(1, 1)]: [3],
    });
    const hint = detectXYWing(board, map);
    expect(hint?.technique).toBe('xy_wing');
    expect(hint?.action.eliminations).toEqual([{ index: indexOf(1, 1), digit: 3 }]);
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectXYWing(empty, cands(empty))).toBeNull();
  });
});

describe('detectXYZWing', () => {
  it('finds a trivalue pivot with two pincers and removes z from a cell seeing all three', () => {
    // pivot {1,2,3} at (1,1); pincers {1,3} at (1,0) and {2,3} at (0,1); 3 is
    // removed from (0,0), which sees the pivot and both pincers (all in box 0).
    const { board, map } = scenario({
      [indexOf(1, 1)]: [1, 2, 3],
      [indexOf(1, 0)]: [1, 3],
      [indexOf(0, 1)]: [2, 3],
      [indexOf(0, 0)]: [3],
    });
    const hint = detectXYZWing(board, map);
    expect(hint?.technique).toBe('xyz_wing');
    expect(hint?.action.eliminations).toEqual([{ index: indexOf(0, 0), digit: 3 }]);
  });
});

describe('detectUniqueRectangle', () => {
  it('removes the pair from the fourth corner of a deadly rectangle', () => {
    // Rectangle on rows 0,1 and cols 0,3 (two boxes). Three corners are {1,2};
    // the fourth (1,3) is {1,2,5} → 1 and 2 are removed from it.
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2],
      [indexOf(0, 3)]: [1, 2],
      [indexOf(1, 0)]: [1, 2],
      [indexOf(1, 3)]: [1, 2, 5],
    });
    const hint = detectUniqueRectangle(board, map);
    expect(hint?.technique).toBe('unique_rectangle');
    const elims = hint!.action.eliminations!;
    expect(elims.every((e) => e.index === indexOf(1, 3))).toBe(true);
    expect(elims.map((e) => e.digit).sort()).toEqual([1, 2]);
  });
});

describe('detectSimpleColoring', () => {
  it('wraps a color whose two cells share a unit', () => {
    // Strong links row0:(0,0)-(0,1), col1:(0,1)-(2,1), row2:(2,1)-(2,2). Coloring
    // gives (0,0) and (2,1) the same shade, but both sit in box 0 — impossible —
    // so 7 is removed from that shade.
    const { board, map } = scenario({
      [indexOf(0, 0)]: [7], [indexOf(0, 1)]: [7],
      [indexOf(2, 1)]: [7], [indexOf(2, 2)]: [7],
    });
    const hint = detectSimpleColoring(board, map);
    expect(hint?.technique).toBe('simple_coloring');
    const idx = hint!.action.eliminations!.map((e) => e.index).sort((a, b) => a - b);
    expect(idx).toEqual([indexOf(0, 0), indexOf(2, 1)].sort((a, b) => a - b));

    // Strong-link chain is exposed as solid arrows on the digit.
    const links = hint!.steps[0].links!;
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.strong && l.from.digit === 7 && l.to.digit === 7)).toBe(true);
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectSimpleColoring(empty, cands(empty))).toBeNull();
  });
});

describe('detectWWing', () => {
  it('removes the shared digit from cells seeing both pair cells', () => {
    // {1,2} at (0,0) and (8,8) (not peers), linked by a strong link on 1 in
    // column 4 → 2 is removed from (0,8), which sees both pair cells.
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2],
      [indexOf(8, 8)]: [1, 2],
      [indexOf(0, 4)]: [1],
      [indexOf(8, 4)]: [1],
      [indexOf(0, 8)]: [2],
    });
    const hint = detectWWing(board, map);
    expect(hint?.technique).toBe('w_wing');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(0, 8), digit: 2 });
  });
});

describe('detectSkyscraper', () => {
  it('finds two row links sharing a base and eliminates from cells seeing both roofs', () => {
    const { board, map } = scenario({
      [indexOf(0, 0)]: [5], [indexOf(0, 1)]: [5], // row 0 link, base col 0
      [indexOf(1, 0)]: [5], [indexOf(1, 2)]: [5], // row 1 link, base col 0
      [indexOf(2, 1)]: [5], // sees both roofs (0,1) and (1,2)
    });
    const hint = detectSkyscraper(board, map);
    expect(hint?.technique).toBe('skyscraper');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(2, 1), digit: 5 });
  });
});

describe('detectTwoStringKite', () => {
  it('links a row and column conjugate pair through a box and eliminates at the far intersection', () => {
    const { board, map } = scenario({
      [indexOf(0, 1)]: [6], [indexOf(0, 7)]: [6], // row 0 link
      [indexOf(1, 2)]: [6], [indexOf(6, 2)]: [6], // col 2 link; (0,1)&(1,2) share box 0
      [indexOf(6, 7)]: [6], // sees (0,7) via col 7 and (6,2) via row 6
    });
    const hint = detectTwoStringKite(board, map);
    expect(hint?.technique).toBe('two_string_kite');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(6, 7), digit: 6 });
  });
});

describe('detectRemotePair', () => {
  it('eliminates both pair digits from a cell seeing opposite ends of the chain', () => {
    // {1,2} chain (0,0)-(0,3)-(3,3)-(3,6); (3,0) holds {1,7} and sees both
    // shades → 1 is removed.
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2], [indexOf(0, 3)]: [1, 2],
      [indexOf(3, 3)]: [1, 2], [indexOf(3, 6)]: [1, 2],
      [indexOf(3, 0)]: [1, 7],
    });
    const hint = detectRemotePair(board, map);
    expect(hint?.technique).toBe('remote_pair');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(3, 0), digit: 1 });

    // The chain is exposed as arrows whose endpoints alternate between the pair.
    const links = hint!.steps[0].links!;
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect([1, 2]).toContain(l.from.digit);
      expect([1, 2]).toContain(l.to.digit);
      expect(l.from.digit).not.toBe(l.to.digit);
    }
  });
});

describe('detectUniqueRectangleType2', () => {
  it('removes the extra digit from cells seeing both roof cells', () => {
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2], [indexOf(0, 3)]: [1, 2], // floor
      [indexOf(1, 0)]: [1, 2, 5], [indexOf(1, 3)]: [1, 2, 5], // roof, extra 5
      [indexOf(1, 6)]: [5], // sees both roof cells along row 1
    });
    const hint = detectUniqueRectangleType2(board, map);
    expect(hint?.technique).toBe('unique_rectangle_2');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(1, 6), digit: 5 });
  });
});

describe('detectBug1', () => {
  it('places the digit that appears three times when only one cell is trivalue', () => {
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2, 3],
      [indexOf(0, 1)]: [1, 2],
      [indexOf(0, 2)]: [1, 3],
    });
    const hint = detectBug1(board, map);
    expect(hint?.technique).toBe('bug1');
    expect(hint?.action.placements).toEqual([{ index: indexOf(0, 0), digit: 1 }]);
  });
});

describe('detectEmptyRectangle', () => {
  it('uses a box L plus a conjugate pair to eliminate down the hinge column', () => {
    const { board, map } = scenario({
      [indexOf(0, 0)]: [4], [indexOf(0, 1)]: [4], [indexOf(1, 0)]: [4], // box 0 L, hinge (0,0)
      [indexOf(0, 5)]: [4], [indexOf(3, 5)]: [4], // conjugate pair in column 5 (hits hinge row)
      [indexOf(3, 0)]: [4], // eliminated: hinge column, conjugate's row
    });
    const hint = detectEmptyRectangle(board, map);
    expect(hint?.technique).toBe('empty_rectangle');
    expect(hint?.action.eliminations).toContainEqual({ index: indexOf(3, 0), digit: 4 });
  });
});

describe('detectUniqueRectangleType4', () => {
  it('removes the non-conjugate pair digit from both roof cells', () => {
    const { board, map } = scenario({
      [indexOf(0, 0)]: [1, 2], [indexOf(0, 3)]: [1, 2], // floor
      [indexOf(1, 0)]: [1, 2, 5], [indexOf(1, 3)]: [1, 2, 5], // roof; 1 is conjugate in row 1
    });
    const hint = detectUniqueRectangleType4(board, map);
    expect(hint?.technique).toBe('unique_rectangle_4');
    const elims = hint!.action.eliminations!;
    expect(elims.every((e) => e.digit === 1 || e.digit === 2)).toBe(true);
    expect(
      elims.every((e) => e.index === indexOf(1, 0) || e.index === indexOf(1, 3)),
    ).toBe(true);
  });
});

describe('detectAic', () => {
  it('finds an alternating inference chain and produces eliminations', () => {
    const { board, map } = scenario({
      [indexOf(0, 0)]: [5], [indexOf(0, 1)]: [5],
      [indexOf(1, 0)]: [5], [indexOf(1, 2)]: [5],
      [indexOf(2, 1)]: [5],
    });
    const hint = detectAic(board, map);
    expect(hint?.technique).toBe('aic');
    expect((hint?.action.eliminations ?? []).length).toBeGreaterThan(0);

    // The chain is exposed as arrows that alternate strong/weak, starting strong.
    const links = hint!.steps[0].links!;
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l, i) => expect(l.strong).toBe(i % 2 === 0));
    // Every cell touched by a link is highlighted in the intro step.
    const ann = hint!.steps[0].annotations;
    for (const l of links) {
      expect(ann[l.from.index]?.highlightNotes).toContain(l.from.digit);
      expect(ann[l.to.index]?.highlightNotes).toContain(l.to.digit);
    }
  });

  it('does not fire on an empty board', () => {
    const empty = createBoard(EMPTY);
    expect(detectAic(empty, cands(empty))).toBeNull();
  });
});

describe('solveBoard + findHint completeness', () => {
  const PUZZLE =
    '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const SOLUTION =
    '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

  it('solves a real puzzle uniquely', () => {
    expect(solveBoard(createBoard(PUZZLE))!.join('')).toBe(SOLUTION);
  });

  it('findHint always returns a sound step that drives the puzzle to its solution', () => {
    let board = createBoard(PUZZLE);
    let guard = 0;
    while (board.some((c) => c.value === null) && guard++ < 200) {
      const hint = findHint(board);
      expect(hint).not.toBeNull();
      // Without penciled notes every hint is a placement (eliminations are gated).
      expect(hint!.action.kind).toBe('place');
      const { index, digit } = hint!.action.placements![0];
      expect(String(SOLUTION[index])).toBe(String(digit)); // sound
      board = placeValue(board, index, digit)!.board;
    }
    expect(boardToString(board)).toBe(SOLUTION);
  });
});
