// Kulostrel - levels.
//
// A level is not a fixed picture but a difficulty setting: every time a level starts, generateLayout() builds a new
// layout from it, so no two games look the same. Difficulty grows through the list:
//
//   colors        how many ball colors (3 -> 6); which ones is picked at random
//   rows          how deep the starting layout is
//   cluster       chance that a ball copies the color of a ball it touches; high = big easy groups
//   gaps          chance of an empty cell below the top row; gaps make the shape ragged and need bank shots
//   secondsPerRow the balls creep down all the time; this is how many seconds they take to move one row
//
// Layout format (also accepted by Board.load): one string is one row, a digit is a color (0 red, 1 yellow, 2 green,
// 3 blue, 4 purple, 5 cyan), '.' is an empty cell. Even rows have 14 cells, odd rows 13 and sit half a ball to the
// right. test/levels.test.js generates many layouts per level and checks them all.

import { Board, EMPTY, rowWidth } from './board.js';

/** How many ball colors exist (see BALL_COLORS in game.js). */
export const COLOR_COUNT = 6;

/** @typedef {{ name: string, colors: number, rows: number, cluster: number, gaps: number, secondsPerRow: number }} Level */

/** @type {Level[]} */
export const LEVELS = [
    { name: 'Rozcvicka', colors: 3, rows: 3, cluster: 0.7, gaps: 0.1, secondsPerRow: 12 },
    { name: 'Lehka chuze', colors: 3, rows: 4, cluster: 0.6, gaps: 0.15, secondsPerRow: 11 },
    { name: 'Ctyri barvy', colors: 4, rows: 4, cluster: 0.6, gaps: 0.15, secondsPerRow: 11 },
    { name: 'Hloubka', colors: 4, rows: 5, cluster: 0.5, gaps: 0.2, secondsPerRow: 10 },
    { name: 'Pet barev', colors: 5, rows: 5, cluster: 0.5, gaps: 0.2, secondsPerRow: 10 },
    { name: 'Houstne to', colors: 5, rows: 6, cluster: 0.45, gaps: 0.25, secondsPerRow: 9 },
    { name: 'Sest barev', colors: 6, rows: 5, cluster: 0.45, gaps: 0.2, secondsPerRow: 9 },
    { name: 'Zrychleni', colors: 6, rows: 6, cluster: 0.4, gaps: 0.25, secondsPerRow: 8 },
    { name: 'Tvrdy orisek', colors: 6, rows: 7, cluster: 0.35, gaps: 0.25, secondsPerRow: 8 },
    { name: 'Finale', colors: 6, rows: 8, cluster: 0.3, gaps: 0.3, secondsPerRow: 7 },
];

/**
 * Build a new random layout for a level.
 *
 * The top row is always full, so the layout hangs from the ceiling; balls that end up cut off by gaps are removed,
 * so nothing floats. Half of the layouts are mirror-symmetric, which looks deliberate rather than noisy.
 *
 * @param {Level} level
 * @param {() => number} random returns a number in [0, 1); the game passes BT.random, tests a seeded generator
 * @returns {string[]}
 */
export function generateLayout(level, random) {
    const int = (/** @type {number} */ n) => Math.floor(random() * n);

    // A random choice of colors, so level 1 is not always red, yellow and green.
    const palette = [...Array(COLOR_COUNT).keys()];

    for (let i = palette.length - 1; i > 0; i--) {
        const j = int(i + 1);

        [palette[i], palette[j]] = [palette[j], palette[i]];
    }

    const colors = palette.slice(0, level.colors);
    const isMirrored = random() < 0.5;

    /** @type {number[][]} */
    const cells = [];

    for (let row = 0; row < level.rows; row++) {
        const width = rowWidth(row);
        const line = new Array(width).fill(EMPTY);
        // Gaps get more likely towards the bottom, so the shape thins out instead of being full of holes.
        const gapChance = row === 0 ? 0 : level.gaps * (0.5 + row / level.rows);
        const last = isMirrored ? Math.ceil(width / 2) : width;

        for (let col = 0; col < last; col++) {
            let color = EMPTY;

            if (random() >= gapChance) {
                const touching = touchingAbove(cells, line, row, col);

                color =
                    touching.length > 0 && random() < level.cluster
                        ? touching[int(touching.length)]
                        : colors[int(colors.length)];
            }

            line[col] = color;

            if (isMirrored) {
                line[width - 1 - col] = color;
            }
        }

        cells.push(line);
    }

    // Drop whatever the gaps cut off from the ceiling.
    const board = new Board();

    cells.forEach((line, row) => {
        line.forEach((color, col) => {
            board.set(row, col, color);
        });
    });
    board.take(board.floating());

    return cells.map((line, row) =>
        line.map((_, col) => (board.get(row, col) === EMPTY ? '.' : String(board.get(row, col)))).join(''),
    );
}

/**
 * Colors of the already generated balls touching a cell: the one to its left and the two above it.
 *
 * @param {number[][]} cells rows above
 * @param {number[]} line the row being filled
 * @param {number} row
 * @param {number} col
 * @returns {number[]}
 */
function touchingAbove(cells, line, row, col) {
    const above = cells[row - 1] ?? [];
    // Odd rows sit half a ball right, so they touch the cell above and the one to its right; even rows reach left.
    const shift = row % 2 === 1 ? 0 : -1;

    return [line[col - 1], above[col + shift], above[col + shift + 1]].filter((c) => c !== undefined && c !== EMPTY);
}
