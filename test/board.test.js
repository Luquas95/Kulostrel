import { describe, expect, test } from 'bun:test';
import { Board, cellCenter, EMPTY, neighbors, rowWidth, STONE } from '../src/board.js';
import { BALL, COLS, MAX_ROWS, ROW_H } from '../src/config.js';

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

describe('special balls', () => {
    test('a pushed row moves every ball one row down and keeps it in place across', () => {
        const b = new Board();

        b.load(['0 1 2', ' 3 4']);

        const before = b.center(1, 0);

        b.push(new Array(b.nextTopWidth()).fill(5));

        expect(b.cells[0]).toHaveLength(COLS - 1);
        expect(b.get(1, 0)).toBe(0);
        expect(b.get(2, 0)).toBe(3);

        const after = b.center(2, 0);

        expect(after.x).toBe(before.x);
        expect(after.y).toBe(before.y + ROW_H);
        expect(b.floating()).toEqual([]);
    });

    test('after a push, neighbors and groups still follow the shifted rows', () => {
        const b = new Board();

        b.load(['0 0']);
        b.push(new Array(b.nextTopWidth()).fill(1));
        // Row 1 is now the old full row and row 0 the new shifted one; a red under the two reds pops all three.
        const result = b.place({ row: 2, col: 0 }, 0);

        expect(result.popped).toHaveLength(3);
    });

    test('chameleons take the next color after every shot', () => {
        const b = new Board();

        b.load(['a 1 2']);
        expect(b.isChameleon(0, 0)).toBe(true);
        b.shiftChameleons([0, 1, 2]);
        expect(b.get(0, 0)).toBe(1);
        b.shiftChameleons([0, 1, 2]);
        b.shiftChameleons([0, 1, 2]);
        expect(b.get(0, 0)).toBe(0);
        expect(b.get(0, 1)).toBe(1);
    });

    test('a chameleon pops with its current color and loses its flag', () => {
        const b = new Board();

        b.load(['a 0']);
        b.place({ row: 0, col: 2 }, 0);
        expect(b.isEmpty()).toBe(true);
        expect(b.isChameleon(0, 0)).toBe(false);
    });

    test('stones never pop and are no color to aim for, but fall with what holds them', () => {
        const b = new Board();

        b.load(['0 0', ' x']);
        expect(b.colorsLeft()).toEqual([0]);
        expect(b.group(1, 0)).toEqual([]);

        const result = b.place({ row: 0, col: 2 }, 0);

        expect(result.dropped.map((d) => d.color)).toEqual([STONE]);
        expect(b.isEmpty()).toBe(true);
    });

    test('a bomb blows away two rings around it, stones included', () => {
        const b = new Board();

        b.load(['0 1 2 3 4 5 0 1', ' x x x x x x x', '1 2 3 4 5 0 1 2']);

        const { popped } = b.placeBomb({ row: 3, col: 3 });
        const hit = popped.map((p) => `${p.cell.row},${p.cell.col}`);

        expect(hit).toContain('2,3');
        expect(hit).toContain('1,2');
        expect(hit).not.toContain('0,3');
        expect(popped.some((p) => p.color === STONE)).toBe(true);
    });

    test('a rainbow ball pops every color it completes', () => {
        const b = new Board();

        // Two reds on the left, two greens on the right of the gap at (0, 2).
        b.load(['0 0 . 2 2']);

        const { popped } = b.placeRainbow({ row: 0, col: 2 }, 3);

        expect(popped).toHaveLength(5);
        expect(b.isEmpty()).toBe(true);
    });

    test('a rainbow ball that completes nothing takes a color it touches, or the fallback', () => {
        const b = new Board();

        b.load(['0 . 2']);
        b.placeRainbow({ row: 0, col: 1 }, 3);
        expect(b.get(0, 1)).toBe(0);
        b.placeRainbow({ row: 0, col: 6 }, 3);
        expect(b.get(0, 6)).toBe(3);
    });
});
