import { describe, expect, test } from 'bun:test';
import { Board, cellCenter, rowWidth, STONE } from '../src/board.js';
import { DEATH_Y, RADIUS, ROW_H } from '../src/config.js';
import {
    COLOR_COUNT,
    ENDLESS_FROM,
    generateLayout,
    generatePushRow,
    LEVELS,
    levelAt,
    MAX_PUSH_ROWS,
    TYPES,
} from '../src/levels.js';

/**
 * A small seeded generator (mulberry32), so a failing layout can be reproduced.
 *
 * @param {number} seed
 * @returns {() => number}
 */
function seeded(seed) {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;

        let t = a;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** How many layouts to generate per level. */
const SAMPLES = 100;

/** Levels 1-20 and a good stretch of the endless ones. */
const CHECKED = Array.from({ length: 60 }, (_, i) => [i + 1, levelAt(i)]);

/**
 * @param {string[]} layout
 * @returns {Board}
 */
function boardOf(layout) {
    const board = new Board();

    board.load(layout);

    return board;
}

describe.each(CHECKED)('level %i', (_n, level) => {
    const layouts = Array.from({ length: SAMPLES }, (_, seed) => generateLayout(level, seeded(seed)));

    test('every row has the right number of cells', () => {
        for (const layout of layouts) {
            expect(layout).toHaveLength(level.rows);
            layout.forEach((line, row) => expect(line).toHaveLength(rowWidth(row)));
        }
    });

    test('uses at most the level’s number of colors, all known', () => {
        for (const layout of layouts) {
            expect(layout.join('')).toMatch(
                new RegExp(`^[0-${COLOR_COUNT - 1}a-${String.fromCharCode(96 + COLOR_COUNT)}x.]*$`),
            );
            expect(boardOf(layout).colorsLeft().length).toBeLessThanOrEqual(level.colors);
        }
    });

    test('the top row is full and nothing floats', () => {
        for (const layout of layouts) {
            expect(layout[0]).not.toMatch(/[.x]/);
            expect(boardOf(layout).floating()).toEqual([]);
        }
    });

    test('leaves room above the line for at least four rows of descent', () => {
        for (const layout of layouts) {
            const bottom = cellCenter(boardOf(layout).lowestRow(), 0, 0).y + RADIUS;

            expect(Math.floor((DEATH_Y - bottom) / ROW_H)).toBeGreaterThanOrEqual(4);
        }
    });

    test('special balls only from the level they are introduced at', () => {
        const n = /** @type {number} */ (_n);

        if (n < 11) {
            expect(level.chameleons + level.stones + level.bombs + level.rainbows + level.pushRows).toBe(0);
        }

        if (n < 13) {
            expect(level.bombs).toBe(0);
        }

        if (n < 15) {
            expect(level.rainbows).toBe(0);
        }

        if (n < 17) {
            expect(level.stones).toBe(0);
        }

        if (n <= ENDLESS_FROM) {
            expect(level.pushRows).toBe(0);
        } else {
            expect(level.pushRows).toBeGreaterThan(0);
            expect(level.pushRows).toBeLessThanOrEqual(MAX_PUSH_ROWS);
            expect(level.pushEvery).toBeGreaterThanOrEqual(3);
        }

        expect(level.colors).toBeLessThanOrEqual(COLOR_COUNT);
    });

    test('layouts differ from game to game', () => {
        expect(new Set(layouts.map((l) => l.join('/'))).size).toBeGreaterThan(SAMPLES * 0.9);
    });
});

test('the same seed gives the same layout', () => {
    expect(generateLayout(LEVELS[5], seeded(42))).toEqual(generateLayout(LEVELS[5], seeded(42)));
});

test('each new thing is introduced at its first level', () => {
    const intros = CHECKED.filter(([, l]) => /** @type {any} */ (l).intro).map(([n, l]) => [
        n,
        /** @type {any} */ (l).intro,
    ]);

    expect(intros).toEqual([
        [11, 'chameleon'],
        [13, 'bomb'],
        [15, 'rainbow'],
        [17, 'stone'],
        [21, 'push'],
    ]);
});

test('endless levels take turns through the types', () => {
    expect(levelAt(ENDLESS_FROM).name).toBe(TYPES[0].name);
    expect(levelAt(ENDLESS_FROM + 1).name).toBe(TYPES[1].name);
    expect(levelAt(ENDLESS_FROM + TYPES.length).name).toBe(TYPES[0].name);
});

test('the descent never slows down and stops at a limit, even far into the endless levels', () => {
    let prev = Infinity;

    for (let i = 0; i < 500; i++) {
        const level = levelAt(i);

        expect(level.secondsPerRow).toBeLessThanOrEqual(prev);
        expect(level.secondsPerRow).toBeGreaterThanOrEqual(4);
        expect(level.pushRows).toBeLessThanOrEqual(MAX_PUSH_ROWS);
        prev = level.secondsPerRow;
    }
});

test('levels 1-10 get harder: colors do not shrink, the total load keeps growing', () => {
    for (let i = 1; i < 10; i++) {
        const [prev, cur] = [LEVELS[i - 1], LEVELS[i]];

        expect(cur.colors).toBeGreaterThanOrEqual(prev.colors);
        expect(cur.cluster).toBeLessThanOrEqual(prev.cluster);
        // Depth can step back when a new color arrives, but the total load (colors x rows) keeps growing.
        expect(cur.colors * cur.rows).toBeGreaterThanOrEqual(prev.colors * prev.rows);
    }
});

test('a pushed row is full and uses the colors still on the board', () => {
    const row = generatePushRow(13, [1, 4], seeded(3));

    expect(row).toHaveLength(13);
    expect(row.every((c) => c === 1 || c === 4)).toBe(true);
    expect(generatePushRow(14, [], seeded(3)).every((c) => c >= 0 && c < COLOR_COUNT && c !== STONE)).toBe(true);
});
