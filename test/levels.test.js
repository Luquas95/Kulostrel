import { describe, expect, test } from 'bun:test';
import { Board, cellCenter, rowWidth } from '../src/board.js';
import { DEATH_Y, RADIUS, ROW_H } from '../src/config.js';
import { LEVELS } from '../src/levels.js';

/** The color count the levels may use (see BALL_COLORS in game.js). */
const COLOR_COUNT = 6;

describe.each(LEVELS.map((level, i) => [i + 1, level]))('level %i', (_n, level) => {
    test('every row has the right number of cells', () => {
        level.layout.forEach((line, row) => {
            expect(line.replace(/\s/g, '').length).toBe(rowWidth(row));
        });
    });

    test('uses only known colors', () => {
        expect(level.layout.join('')).toMatch(new RegExp(`^[0-${COLOR_COUNT - 1}. ]*$`));
    });

    test('nothing floats at the start', () => {
        const board = new Board();

        board.load(level.layout);
        expect(board.floating()).toEqual([]);
    });

    test('leaves room above the line for a few ceiling drops', () => {
        const board = new Board();

        board.load(level.layout);

        const bottom = cellCenter(board.lowestRow(), 0, 0).y + RADIUS;

        expect(Math.floor((DEATH_Y - bottom) / ROW_H)).toBeGreaterThanOrEqual(4);
    });
});

test('difficulty never gets easier: colors do not shrink, shots per drop do not grow', () => {
    const counts = LEVELS.map((level) => {
        const board = new Board();

        board.load(level.layout);

        return board.colorsLeft().length;
    });

    for (let i = 1; i < LEVELS.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
        expect(LEVELS[i].shotsPerDrop).toBeLessThanOrEqual(LEVELS[i - 1].shotsPerDrop);
    }
});
