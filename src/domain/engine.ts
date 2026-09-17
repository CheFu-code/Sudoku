/**
 * The game engine: pure transformations of the board. Each mutating function
 * returns the new board plus a reversible `Move`, or `null` if the action is a
 * no-op or rejected (e.g. editing a given, or an invalid validated note).
 *
 * No framework or storage imports — this module is fully unit-testable.
 */

import { allCandidates, candidatesFor } from './candidates';
import { cloneCell, withCell } from './board';
import { getPeers, isValidPlacement } from './rules';
import type { Board, Cell, CellIndex, Digit, Move } from './types';

export interface EngineResult {
    board: Board;
    move: Move;
}

function snapshot(board: Board, indices: CellIndex[]) {
    return indices.map((index) => ({ index, cell: cloneCell(board[index]) }));
}

/**
 * Place (or clear) a definitive value. Placing the value already present clears
 * the cell. Placing a value clears that cell's notes. No-op on givens.
 *
 * When `removePeerNotes` is set, placing a value also strips that value from
 * the pencil notes of its peers (those candidates are no longer possible). The
 * whole thing is one reversible move so a single undo restores the peer notes.
 */
export function placeValue(
    board: Board,
    index: CellIndex,
    value: Digit,
    removePeerNotes = false,
): EngineResult | null {
    const cell = board[index];
    if (cell.given) return null;

    const isClear = cell.value === value;
    const nextCell: Cell = isClear
        ? { value: null, given: false, notes: new Set() }
        : { value, given: false, notes: new Set() };

    // No change (e.g. clearing an already-empty cell).
    if (cell.value === nextCell.value && cell.notes.size === nextCell.notes.size) {
        return null;
    }

    // Peers that still pencil this value can no longer hold it once placed.
    const peerCleanup =
        removePeerNotes && !isClear
            ? [...getPeers(index)].filter((p) => board[p].notes.has(value))
            : [];

    const affected = [index, ...peerCleanup];
    const before = snapshot(board, affected);

    const nextBoard = board.slice();
    nextBoard[index] = nextCell;
    for (const p of peerCleanup) {
        const notes = new Set(nextBoard[p].notes);
        notes.delete(value);
        nextBoard[p] = { ...nextBoard[p], notes };
    }

    const after = snapshot(nextBoard, affected);
    return { board: nextBoard, move: { type: 'place', before, after } };
}

/**
 * Toggle a pencil note. No-op on givens or filled cells. When `validate` is
 * true, refuses to add a note whose value already appears in a peer.
 */
export function toggleNote(
    board: Board,
    index: CellIndex,
    value: Digit,
    validate = true,
): EngineResult | null {
    const cell = board[index];
    if (cell.given || cell.value !== null) return null;

    const has = cell.notes.has(value);
    // Only block *adding* an illegal note; removing is always allowed.
    if (!has && validate && !isValidPlacement(board, index, value)) return null;

    const before = snapshot(board, [index]);
    const notes = new Set(cell.notes);
    if (has) notes.delete(value);
    else notes.add(value);

    const nextBoard = withCell(board, index, { ...cell, notes });
    const after = snapshot(nextBoard, [index]);
    return { board: nextBoard, move: { type: 'note', before, after } };
}

/** Clear a cell's value and notes. No-op on givens or already-empty cells. */
export function eraseCell(board: Board, index: CellIndex): EngineResult | null {
    const cell = board[index];
    if (cell.given) return null;
    if (cell.value === null && cell.notes.size === 0) return null;

    const before = snapshot(board, [index]);
    const nextBoard = withCell(board, index, {
        value: null,
        given: false,
        notes: new Set(),
    });
    const after = snapshot(nextBoard, [index]);
    return { board: nextBoard, move: { type: 'erase', before, after } };
}

/**
 * Fast Pencil: fill every empty cell's notes with its legal candidates. Emitted
 * as a single batched, undoable move.
 */
export function applyAutoNotes(board: Board): EngineResult | null {
    const candidates = allCandidates(board);
    const indices = [...candidates.keys()];
    if (indices.length === 0) return null;

    const before = snapshot(board, indices);
    let nextBoard = board.slice();
    for (const index of indices) {
        const notes = candidates.get(index)!;
        nextBoard[index] = { ...nextBoard[index], notes };
    }
    const after = snapshot(nextBoard, indices);
    return { board: nextBoard, move: { type: 'autoNotes', before, after } };
}

/**
 * Remove specific candidates from cells' pencil notes, as one batched, undoable
 * move. Used by Smart Hint's elimination techniques (naked/pointing pair).
 * Only digits actually penciled are removed; returns `null` if nothing changes.
 *
 * With `seedEmptyTargets`, an empty target cell with no notes first gets its
 * legal candidates penciled in, then the eliminated digits struck — so a
 * no-notes player can still apply an elimination hint. Only the target cells
 * are seeded, never the whole board, and it all stays one undoable move.
 */
export function applyEliminations(
    board: Board,
    eliminations: { index: CellIndex; digit: Digit }[],
    seedEmptyTargets = false,
): EngineResult | null {
    // Cells to seed with their legal candidates before striking.
    const seed = new Set<CellIndex>();
    // Group the digits to strip per cell, keeping only ones currently noted
    // (or about to be seeded).
    const perCell = new Map<CellIndex, Set<Digit>>();
    for (const { index, digit } of eliminations) {
        const cell = board[index];
        const seeding =
            seedEmptyTargets && cell.value === null && cell.notes.size === 0;
        if (seeding) seed.add(index);
        if (cell.notes.has(digit) || seeding) {
            (perCell.get(index) ?? perCell.set(index, new Set()).get(index)!).add(digit);
        }
    }
    const indices = [...perCell.keys()];
    if (indices.length === 0) return null;

    const before = snapshot(board, indices);
    const nextBoard = board.slice();
    for (const index of indices) {
        const notes = seed.has(index)
            ? new Set(candidatesFor(board, index))
            : new Set(nextBoard[index].notes);
        for (const d of perCell.get(index)!) notes.delete(d);
        nextBoard[index] = { ...nextBoard[index], notes };
    }
    const after = snapshot(nextBoard, indices);
    return { board: nextBoard, move: { type: 'note', before, after } };
}

/** Apply a move's "before" snapshots — used by the history/undo system. */
export function applySnapshots(
    board: Board,
    snapshots: { index: CellIndex; cell: Cell }[],
): Board {
    let next = board.slice();
    for (const { index, cell } of snapshots) {
        next[index] = cloneCell(cell);
    }
    return next;
}

/** The board matches the puzzle's solution. */
export function isSolved(board: Board, solution: string): boolean {
    for (let i = 0; i < board.length; i++) {
        if (board[i].value === null) return false;
        if (String(board[i].value) !== solution[i]) return false;
    }
    return true;
}
