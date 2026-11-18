import { describe, expect, test } from 'bun:test';
import { Board, cellCenter, EMPTY, neighbors, rowWidth } from '../src/board.js';
import { BALL, COLS, MAX_ROWS } from '../src/config.js';

describe('grid shape', () => {
    test('even rows are full width, odd rows one less', () => {
        expect(rowWidth(0)).toBe(COLS);
        expect(rowWidth(1)).toBe(COLS - 1);
    });

    test('neighbors of an even row reach left, of an odd row reach right', () => {
        const even = neighbors(2, 5).map((n) => `${n.row},${n.col}`);
        const odd = neighbors(3, 5).map((n) => `${n.row},${n.col}`);

        expect(even.sort()).toEqual(['1,4', '1,5', '2,4', '2,6', '3,4', '3,5'].sort());
        expect(odd.sort()).toEqual(['2,5', '2,6', '3,4', '3,6', '4,5', '4,6'].sort());
    });

    test('neighbors stay on the board', () => {
        expect(neighbors(0, 0).every((n) => n.row >= 0 && n.col >= 0)).toBe(true);
        expect(neighbors(MAX_ROWS - 1, 0).every((n) => n.row < MAX_ROWS)).toBe(true);
    });

    test('touching cells are one ball apart', () => {
        for (const n of neighbors(4, 6)) {
            const a = cellCenter(4, 6, 0);
            const b = cellCenter(n.row, n.col, 0);

            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(BALL - 0.5);
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(BALL + 0.5);
        }
    });
});

describe('Board', () => {
    test('load reads digits and ignores spaces', () => {
        const b = new Board();

        b.load(['0 1 .', ' 2']);
        expect(b.get(0, 0)).toBe(0);
        expect(b.get(0, 1)).toBe(1);
        expect(b.get(0, 2)).toBe(EMPTY);
        expect(b.get(1, 0)).toBe(2);
        expect(b.colorsLeft()).toEqual([0, 1, 2]);
    });

    test('three of a color pop, two do not', () => {
        const b = new Board();

        b.load(['0 0 1']);
        expect(b.place({ row: 1, col: 2 }, 1).popped).toHaveLength(0);

        const result = b.place({ row: 1, col: 0 }, 0);

        expect(result.popped).toHaveLength(3);
        expect(b.get(0, 0)).toBe(EMPTY);
        expect(b.get(0, 1)).toBe(EMPTY);
    });

    test('balls that lose their hold fall', () => {
        const b = new Board();

        // Two reds hang from the ceiling; a blue hangs below them, a green below the blue.
        b.load(['0 0', ' 3', '. 2']);
        expect(b.floating()).toHaveLength(0);

        const result = b.place({ row: 0, col: 2 }, 0);

        expect(result.popped).toHaveLength(3);
        expect(result.dropped.map((d) => d.color).sort()).toEqual([2, 3]);
        expect(b.isEmpty()).toBe(true);
    });

    test('a ball snaps to the nearest free cell that can hold it', () => {
        const b = new Board();

        b.load(['0']);

        const below = cellCenter(1, 0, 0);

        expect(b.snap(below.x + 1, below.y)).toEqual({ row: 1, col: 0 });

        const top = cellCenter(0, 5, 0);

        expect(b.snap(top.x, top.y)).toEqual({ row: 0, col: 5 });
    });

    test('snap follows the lowered ceiling', () => {
        const b = new Board();

        b.load(['0']);
        b.descend(1);

        const p = cellCenter(1, 0, 1);

        expect(b.snap(p.x, p.y)).toEqual({ row: 1, col: 0 });
    });

    test('snap works while the board is between rows', () => {
        const b = new Board();

        b.load(['0 0 0', ' 0 0']);
        b.descend(2.6);

        const p = cellCenter(2, 1, b.drop);

        expect(b.snap(p.x + 0.5, p.y - 0.5)).toEqual({ row: 2, col: 1 });
    });

    test('lowestRow reports the deepest ball', () => {
        const b = new Board();

        expect(b.lowestRow()).toBe(-1);
        b.load(['0', ' 0', '0']);
        expect(b.lowestRow()).toBe(2);
    });
});
