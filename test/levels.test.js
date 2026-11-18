import { describe, expect, test } from 'bun:test';
import { Board, cellCenter, rowWidth } from '../src/board.js';
import { DEATH_Y, RADIUS, ROW_H } from '../src/config.js';
import { COLOR_COUNT, generateLayout, LEVELS } from '../src/levels.js';

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
const SAMPLES = 200;

/**
 * @param {string[]} layout
 * @returns {Board}
 */
function boardOf(layout) {
    const board = new Board();

    board.load(layout);

    return board;
}

describe.each(LEVELS.map((level, i) => [i + 1, level]))('level %i', (_n, level) => {
    const layouts = Array.from({ length: SAMPLES }, (_, seed) => generateLayout(level, seeded(seed)));

    test('every row has the right number of cells', () => {
        for (const layout of layouts) {
            expect(layout).toHaveLength(level.rows);
            layout.forEach((line, row) => expect(line).toHaveLength(rowWidth(row)));
        }
    });

    test('uses at most the level’s number of colors, all known', () => {
        for (const layout of layouts) {
            expect(layout.join('')).toMatch(new RegExp(`^[0-${COLOR_COUNT - 1}.]*$`));
            expect(boardOf(layout).colorsLeft().length).toBeLessThanOrEqual(level.colors);
        }
    });

    test('the top row is full and nothing floats', () => {
        for (const layout of layouts) {
            expect(layout[0]).not.toContain('.');
            expect(boardOf(layout).floating()).toEqual([]);
        }
    });

    test('leaves room above the line for at least four rows of descent', () => {
        for (const layout of layouts) {
            const bottom = cellCenter(boardOf(layout).lowestRow(), 0, 0).y + RADIUS;

            expect(Math.floor((DEATH_Y - bottom) / ROW_H)).toBeGreaterThanOrEqual(4);
        }
    });

    test('layouts differ from game to game', () => {
        expect(new Set(layouts.map((l) => l.join('/'))).size).toBeGreaterThan(SAMPLES * 0.9);
    });
});

test('the same seed gives the same layout', () => {
    expect(generateLayout(LEVELS[5], seeded(42))).toEqual(generateLayout(LEVELS[5], seeded(42)));
});

test('difficulty never gets easier', () => {
    for (let i = 1; i < LEVELS.length; i++) {
        const [prev, cur] = [LEVELS[i - 1], LEVELS[i]];

        expect(cur.colors).toBeGreaterThanOrEqual(prev.colors);
        expect(cur.colors).toBeLessThanOrEqual(COLOR_COUNT);
        expect(cur.cluster).toBeLessThanOrEqual(prev.cluster);
        expect(cur.secondsPerRow).toBeLessThanOrEqual(prev.secondsPerRow);
        // Depth can step back when a new color arrives, but the total load (colors x rows) keeps growing.
        expect(cur.colors * cur.rows).toBeGreaterThanOrEqual(prev.colors * prev.rows);
    }
});
