// Kulostrel - levels.
//
// A level is not a fixed picture but a difficulty setting: every time a level starts, generateLayout() builds a new
// layout from it, so no two games look the same. levelAt() gives the setting for any level number, so the game goes
// on forever:
//
//   1-10   the basics: more colors (3 -> 6), deeper layouts, a faster descent
//   11-20  special balls, one new kind at a time (each one is introduced on a card before its level):
//          11 chameleons, 13 bombs, 15 rainbows, 17 stones; 19 and 20 mix them all
//   21+    endless: rows are pushed in from the top as well (a few per level, never more than MAX_PUSH_ROWS). The
//          levels take turns through four kinds (TYPES) and get harder step by step
//
// Settings:
//
//   colors        how many ball colors (at most COLOR_COUNT); which ones is picked at random
//   rows          how deep the starting layout is
//   cluster       chance that a ball copies the color of a ball it touches; high = big easy groups
//   gaps          chance of an empty cell below the top row; gaps make the shape ragged and need bank shots
//   seconds       the clock: every second left when the level is cleared is a bonus (scoring.js)
//   secondsPerRow the balls creep down all the time; this is how many seconds they take to move one row
//   chameleons    share of the balls that change color after every shot
//   stones        share of the balls (below the top row) that are stones
//   bombs         chance that a ball you get is a bomb
//   rainbows      chance that a ball you get is a rainbow ball
//   pushRows      how many rows are pushed in from the top during the level
//   pushEvery     a row comes in after this many shots
//   intro         the card shown before the level, when it brings something new
//
// Layout format (also accepted by Board.load): one string is one row, a digit is a color (0 red, 1 yellow, 2 green,
// 3 blue, 4 purple, 5 cyan), 'a'-'f' a chameleon of color 0-5, 'x' a stone, '.' an empty cell. Even rows have 14
// cells, odd rows 13 and sit half a ball to the right. test/levels.test.js generates many layouts per level and checks
// them all.

import { Board, EMPTY, rowWidth, STONE } from './board.js';

/** How many ball colors exist (see BALL_COLORS in game.js). */
export const COLOR_COUNT = 6;

/** No level pushes in more rows than this. */
export const MAX_PUSH_ROWS = 6;

/** The first endless level (index, so level 21). */
export const ENDLESS_FROM = 20;

/** @typedef {'chameleon' | 'bomb' | 'rainbow' | 'stone' | 'push'} Intro */

/**
 * @typedef {object} Level
 * @property {string} name
 * @property {number} colors
 * @property {number} rows
 * @property {number} cluster
 * @property {number} gaps
 * @property {number} seconds
 * @property {number} secondsPerRow
 * @property {number} chameleons
 * @property {number} stones
 * @property {number} bombs
 * @property {number} rainbows
 * @property {number} pushRows
 * @property {number} pushEvery
 * @property {Intro | null} intro
 */

/** @type {Omit<Level, 'name' | 'colors' | 'rows' | 'cluster' | 'gaps' | 'seconds' | 'secondsPerRow'>} */
const PLAIN = { chameleons: 0, stones: 0, bombs: 0, rainbows: 0, pushRows: 0, pushEvery: 0, intro: null };

/** Levels 11-20 share these; each adds its own specials. */
const SPECIAL = { ...PLAIN, colors: 6, cluster: 0.4, gaps: 0.2, seconds: 80 };

/** @type {Level[]} levels 1-20 */
export const LEVELS = [
    { ...PLAIN, name: 'Rozcvicka', colors: 3, rows: 3, cluster: 0.7, gaps: 0.1, seconds: 45, secondsPerRow: 12 },
    { ...PLAIN, name: 'Lehka chuze', colors: 3, rows: 4, cluster: 0.6, gaps: 0.15, seconds: 50, secondsPerRow: 11 },
    { ...PLAIN, name: 'Ctyri barvy', colors: 4, rows: 4, cluster: 0.6, gaps: 0.15, seconds: 55, secondsPerRow: 11 },
    { ...PLAIN, name: 'Hloubka', colors: 4, rows: 5, cluster: 0.5, gaps: 0.2, seconds: 60, secondsPerRow: 10 },
    { ...PLAIN, name: 'Pet barev', colors: 5, rows: 5, cluster: 0.5, gaps: 0.2, seconds: 65, secondsPerRow: 10 },
    { ...PLAIN, name: 'Houstne to', colors: 5, rows: 6, cluster: 0.45, gaps: 0.25, seconds: 70, secondsPerRow: 9 },
    { ...PLAIN, name: 'Sest barev', colors: 6, rows: 5, cluster: 0.45, gaps: 0.2, seconds: 70, secondsPerRow: 9 },
    { ...PLAIN, name: 'Zrychleni', colors: 6, rows: 6, cluster: 0.4, gaps: 0.25, seconds: 75, secondsPerRow: 8 },
    { ...PLAIN, name: 'Tvrdy orisek', colors: 6, rows: 7, cluster: 0.35, gaps: 0.25, seconds: 80, secondsPerRow: 8 },
    { ...PLAIN, name: 'Finale', colors: 6, rows: 8, cluster: 0.3, gaps: 0.3, seconds: 90, secondsPerRow: 7 },
    // A new kind of ball comes with a shallower layout, so there is room to learn it.
    { ...SPECIAL, name: 'Kameleoni', rows: 5, secondsPerRow: 7, chameleons: 0.1, intro: 'chameleon' },
    { ...SPECIAL, name: 'Prevleky', rows: 6, secondsPerRow: 7, chameleons: 0.15 },
    { ...SPECIAL, name: 'Bomba', rows: 5, secondsPerRow: 7, chameleons: 0.1, bombs: 0.1, intro: 'bomb' },
    { ...SPECIAL, name: 'Ohnostroj', rows: 6, secondsPerRow: 6.5, chameleons: 0.15, bombs: 0.08 },
    {
        ...SPECIAL,
        name: 'Duha',
        rows: 5,
        secondsPerRow: 6.5,
        chameleons: 0.1,
        bombs: 0.05,
        rainbows: 0.1,
        intro: 'rainbow',
    },
    { ...SPECIAL, name: 'Barevny chaos', rows: 6, secondsPerRow: 6.5, chameleons: 0.15, bombs: 0.06, rainbows: 0.08 },
    {
        ...SPECIAL,
        name: 'Kameny',
        rows: 5,
        secondsPerRow: 6.5,
        chameleons: 0.1,
        stones: 0.08,
        bombs: 0.08,
        rainbows: 0.05,
        intro: 'stone',
    },
    { ...SPECIAL, name: 'Lom', rows: 6, secondsPerRow: 6, chameleons: 0.12, stones: 0.1, bombs: 0.08, rainbows: 0.06 },
    {
        ...SPECIAL,
        name: 'Vsechno naraz',
        rows: 7,
        secondsPerRow: 6,
        chameleons: 0.15,
        stones: 0.1,
        bombs: 0.07,
        rainbows: 0.07,
    },
    {
        ...SPECIAL,
        name: 'Velke finale',
        rows: 8,
        seconds: 90,
        secondsPerRow: 6,
        chameleons: 0.15,
        stones: 0.1,
        bombs: 0.07,
        rainbows: 0.07,
    },
];

/**
 * The four kinds of endless levels, in turn. Each one leans on one thing; difficulty() adds the rest.
 *
 * @type {{ name: string, tweak: (level: Level) => Partial<Level> }[]}
 */
export const TYPES = [
    {
        name: 'Tlak shora',
        tweak: (l) => ({ pushRows: Math.min(MAX_PUSH_ROWS, l.pushRows + 1), pushEvery: Math.max(3, l.pushEvery - 1) }),
    },
    { name: 'Kamenolom', tweak: (l) => ({ stones: l.stones + 0.08 }) },
    { name: 'Kameleoni', tweak: (l) => ({ chameleons: l.chameleons + 0.15 }) },
    {
        name: 'Ohnostroj',
        tweak: (l) => ({ bombs: l.bombs + 0.05, rainbows: l.rainbows + 0.05, cluster: l.cluster - 0.1 }),
    },
];

/**
 * The setting for any level.
 *
 * @param {number} index 0 for level 1
 * @returns {Level}
 */
export function levelAt(index) {
    if (index < ENDLESS_FROM) {
        return LEVELS[index];
    }

    // d: how far into the endless part. Everything moves a little with every level and stops at a hard limit.
    const d = index - ENDLESS_FROM;
    /** @type {Level} */
    const base = {
        name: '',
        colors: COLOR_COUNT,
        rows: d < 12 ? 5 : 6,
        cluster: Math.max(0.2, 0.4 - d * 0.01),
        gaps: 0.2,
        seconds: 90,
        secondsPerRow: Math.max(4, 6 - d * 0.05),
        chameleons: Math.min(0.2, 0.08 + d * 0.005),
        stones: Math.min(0.12, 0.05 + d * 0.003),
        bombs: 0.06,
        rainbows: 0.06,
        pushRows: Math.min(MAX_PUSH_ROWS, 2 + Math.floor(d / 4)),
        pushEvery: Math.max(4, 8 - Math.floor(d / 5)),
        intro: d === 0 ? 'push' : null,
    };
    const type = TYPES[d % TYPES.length];
    const level = { ...base, ...type.tweak(base), name: type.name };

    level.pushRows = Math.min(MAX_PUSH_ROWS, level.pushRows);
    level.chameleons = Math.min(0.35, level.chameleons);
    level.stones = Math.min(0.2, level.stones);

    return level;
}

/**
 * Build a new random layout for a level.
 *
 * The top row is always full, so the layout hangs from the ceiling; balls that end up cut off by gaps are removed,
 * so nothing floats. Half of the layouts are mirror-symmetric, which looks deliberate rather than noisy. Stones are
 * never in the top row, so everything can still be shot down.
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
        line
            .map((_, col) => {
                const color = board.get(row, col);

                if (color === EMPTY) {
                    return '.';
                }

                // Turning a ball into a stone or a chameleon keeps the shape, so nothing starts to float.
                if (row > 0 && random() < level.stones) {
                    return 'x';
                }

                return random() < level.chameleons ? String.fromCharCode(97 + color) : String(color);
            })
            .join(''),
    );
}

/**
 * A row to push in from the top: random colors from those still on the board, no gaps.
 *
 * @param {number} width
 * @param {number[]} colors
 * @param {() => number} random
 * @returns {number[]}
 */
export function generatePushRow(width, colors, random) {
    const pool = colors.length > 0 ? colors : [...Array(COLOR_COUNT).keys()];
    /** @type {number[]} */
    const row = [];

    for (let col = 0; col < width; col++) {
        // Pairs of the same color now and then, so a pushed row is not pure noise.
        const prev = row[col - 1];

        row.push(prev !== undefined && random() < 0.4 ? prev : pool[Math.floor(random() * pool.length)]);
    }

    return row;
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

    return [line[col - 1], above[col + shift], above[col + shift + 1]].filter(
        (c) => c !== undefined && c !== EMPTY && c !== STONE,
    );
}
