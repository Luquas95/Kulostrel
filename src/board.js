// Kulostrel - the ball grid.
//
// Pure game logic with no engine calls, so it can be unit-tested (`bun test`).
//
// The grid is a hex layout stored as rows. Every other row is shifted right by half a ball and holds one ball fewer.
// Which rows are the shifted ones is the board's parity: it flips when a new row is pushed in from the top, so the
// balls already there keep their places. A cell holds a color number (0, 1, 2, ...), STONE or EMPTY. Row 0 hangs
// from the ceiling.
//
// Special balls:
// - chameleon: an ordinary colored ball that takes the next color after every shot (a flag next to the color)
// - stone: never pops; it only falls when it loses its hold, or a bomb blows it away
// - bomb and rainbow are never on the board: they are shot (placeBomb, placeRainbow)

import { BALL, COLS, FIELD_TOP, FIELD_X, MATCH_MIN, MAX_ROWS, RADIUS, ROW_H } from './config.js';

export const EMPTY = -1;

/** A ball that cannot be popped. It is stored like a color, but no shot ever has this color. */
export const STONE = 9;

/** How many rings of neighbors a bomb blows away. */
export const BOMB_RINGS = 2;

/** @typedef {{ row: number, col: number }} Cell */
/** @typedef {{ cell: Cell, color: number }} Taken */
/** @typedef {{ popped: Taken[], dropped: Taken[] }} PlaceResult */

/**
 * @param {number} row
 * @param {number} [parity] 1 when the board's rows are flipped (see Board.parity)
 * @returns {boolean} true for a row shifted half a ball to the right
 */
function isShifted(row, parity = 0) {
    return (row + parity) % 2 === 1;
}

/**
 * @param {number} row
 * @param {number} [parity]
 * @returns {number} how many cells this row has
 */
export function rowWidth(row, parity = 0) {
    return isShifted(row, parity) ? COLS - 1 : COLS;
}

/**
 * @param {number} row
 * @param {number} col
 * @param {number} [parity]
 * @returns {boolean}
 */
export function isInside(row, col, parity = 0) {
    return row >= 0 && row < MAX_ROWS && col >= 0 && col < rowWidth(row, parity);
}

// Neighbor offsets [row, col]. Around a full row the rows above and below reach left; around a shifted row, right.
const NEIGHBORS_FULL = [
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 0],
    [1, -1],
    [1, 0],
];
const NEIGHBORS_SHIFTED = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [-1, 1],
    [1, 0],
    [1, 1],
];

/**
 * @param {number} row
 * @param {number} col
 * @param {number} [parity]
 * @returns {Cell[]} the cells that touch this one and exist on the board
 */
export function neighbors(row, col, parity = 0) {
    const offsets = isShifted(row, parity) ? NEIGHBORS_SHIFTED : NEIGHBORS_FULL;
    /** @type {Cell[]} */
    const result = [];

    for (const [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;

        if (isInside(r, c, parity)) {
            result.push({ row: r, col: c });
        }
    }

    return result;
}

/**
 * Center of a cell in screen pixels (floats are fine here; drawing floors them).
 *
 * @param {number} row
 * @param {number} col
 * @param {number} drop how far the ceiling has moved down, in rows (may be a fraction)
 * @param {number} [parity]
 * @returns {{ x: number, y: number }}
 */
export function cellCenter(row, col, drop, parity = 0) {
    return {
        x: FIELD_X + RADIUS + col * BALL + (isShifted(row, parity) ? RADIUS : 0),
        y: FIELD_TOP + RADIUS + (row + drop) * ROW_H,
    };
}

export class Board {
    /** @type {number[][]} */
    cells = [];

    /** @type {boolean[][]} true where the ball is a chameleon */
    chameleon = [];

    /** How far the ceiling has moved down, in rows. Grows smoothly, so it is usually a fraction. */
    drop = 0;

    /** 0 or 1: flips with every row pushed in from the top. */
    parity = 0;

    constructor() {
        this.clear();
    }

    clear() {
        this.cells = [];
        this.chameleon = [];
        this.drop = 0;
        this.parity = 0;

        for (let row = 0; row < MAX_ROWS; row++) {
            this.cells.push(new Array(rowWidth(row)).fill(EMPTY));
            this.chameleon.push(new Array(rowWidth(row)).fill(false));
        }
    }

    /**
     * Fill the board from a level layout: one string per row, one character per cell. '.' is empty, a digit is a
     * color, 'a'-'f' a chameleon of color 0-5, 'x' a stone. Spaces are ignored, so layouts can be indented to show the
     * hex shift. Missing cells stay empty.
     *
     * @param {string[]} rows
     */
    load(rows) {
        this.clear();

        rows.forEach((line, row) => {
            const chars = line.replace(/\s/g, '');

            for (let col = 0; col < Math.min(chars.length, rowWidth(row)); col++) {
                const ch = chars[col];

                if (ch >= '0' && ch <= '9') {
                    this.cells[row][col] = Number(ch);
                } else if (ch >= 'a' && ch <= 'f') {
                    this.cells[row][col] = ch.charCodeAt(0) - 97;
                    this.chameleon[row][col] = true;
                } else if (ch === 'x') {
                    this.cells[row][col] = STONE;
                }
            }
        });
    }

    /**
     * @param {number} row
     * @param {number} col
     * @returns {number} the color in the cell, or EMPTY (also for cells off the board)
     */
    get(row, col) {
        return isInside(row, col, this.parity) ? this.cells[row][col] : EMPTY;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {number} color
     * @param {boolean} [isChameleon]
     */
    set(row, col, color, isChameleon = false) {
        this.cells[row][col] = color;
        this.chameleon[row][col] = isChameleon && color !== EMPTY;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    isChameleon(row, col) {
        return isInside(row, col, this.parity) && this.chameleon[row][col];
    }

    /** @returns {boolean} true when no ball is left */
    isEmpty() {
        return this.cells.every((row) => row.every((c) => c === EMPTY));
    }

    /** @returns {number[]} the colors still on the board that a shot can match (no stones), sorted */
    colorsLeft() {
        const set = new Set();

        for (const row of this.cells) {
            for (const c of row) {
                if (c !== EMPTY && c !== STONE) {
                    set.add(c);
                }
            }
        }

        return [...set].sort((a, b) => a - b);
    }

    /** @returns {number} the lowest row index that holds a ball, or -1 when empty */
    lowestRow() {
        for (let row = MAX_ROWS - 1; row >= 0; row--) {
            if (this.cells[row].some((c) => c !== EMPTY)) {
                return row;
            }
        }

        return -1;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @returns {Cell[]}
     */
    neighbors(row, col) {
        return neighbors(row, col, this.parity);
    }

    /**
     * @param {number} row
     * @param {number} col
     * @returns {{ x: number, y: number }}
     */
    center(row, col) {
        return cellCenter(row, col, this.drop, this.parity);
    }

    /**
     * An empty cell can take a ball if it hangs from the ceiling (row 0) or touches another ball.
     *
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    canHold(row, col) {
        if (!isInside(row, col, this.parity) || this.cells[row][col] !== EMPTY) {
            return false;
        }

        return row === 0 || this.neighbors(row, col).some((n) => this.cells[n.row][n.col] !== EMPTY);
    }

    /**
     * Where a flying ball sticks: the free cell nearest to its center that can hold a ball.
     *
     * @param {number} x ball center
     * @param {number} y ball center
     * @returns {Cell | null}
     */
    snap(x, y) {
        const approxRow = Math.round((y - FIELD_TOP - RADIUS) / ROW_H - this.drop);
        /** @type {Cell | null} */
        let best = null;
        let bestDist = Infinity;

        for (let row = approxRow - 1; row <= approxRow + 1; row++) {
            for (let col = 0; col < rowWidth(Math.max(row, 0), this.parity); col++) {
                if (!this.canHold(row, col)) {
                    continue;
                }

                const c = this.center(row, col);
                const d = (c.x - x) ** 2 + (c.y - y) ** 2;

                if (d < bestDist) {
                    bestDist = d;
                    best = { row, col };
                }
            }
        }

        return best;
    }

    /**
     * All balls of the same color connected to this cell, the cell included. Stones never form a group.
     *
     * @param {number} row
     * @param {number} col
     * @returns {Cell[]}
     */
    group(row, col) {
        const color = this.get(row, col);

        if (color === EMPTY || color === STONE) {
            return [];
        }

        return this.flood([{ row, col }], (r, c) => this.cells[r][c] === color);
    }

    /**
     * Balls that no longer connect to the ceiling. They fall.
     *
     * @returns {Cell[]}
     */
    floating() {
        /** @type {Cell[]} */
        const roots = [];

        for (let col = 0; col < this.cells[0].length; col++) {
            if (this.cells[0][col] !== EMPTY) {
                roots.push({ row: 0, col });
            }
        }

        const held = new Set(this.flood(roots, (r, c) => this.cells[r][c] !== EMPTY).map((n) => n.row * 100 + n.col));
        /** @type {Cell[]} */
        const result = [];

        this.cells.forEach((cells, row) => {
            cells.forEach((c, col) => {
                if (c !== EMPTY && !held.has(row * 100 + col)) {
                    result.push({ row, col });
                }
            });
        });

        return result;
    }

    /**
     * Place a ball and resolve it: pop its group if it is big enough, then drop whatever lost its hold.
     *
     * @param {Cell} cell
     * @param {number} color
     * @returns {PlaceResult}
     */
    place(cell, color) {
        this.set(cell.row, cell.col, color);

        const g = this.group(cell.row, cell.col);

        if (g.length < MATCH_MIN) {
            return { popped: [], dropped: [] };
        }

        return this.resolve(g);
    }

    /**
     * A bomb sticks here and blows away every ball within BOMB_RINGS rings of neighbors, stones included.
     *
     * @param {Cell} cell
     * @returns {PlaceResult}
     */
    placeBomb(cell) {
        const area = this.flood([cell], () => true, BOMB_RINGS);

        return this.resolve(area.filter((n) => this.cells[n.row][n.col] !== EMPTY));
    }

    /**
     * A rainbow ball sticks here and counts as every color it touches: each touching color whose group (with the
     * rainbow in it) is big enough pops. If none is, it stays as the color it touches most (or `fallback`).
     *
     * @param {Cell} cell
     * @param {number} fallback color to keep when it touches no colored ball
     * @returns {PlaceResult}
     */
    placeRainbow(cell, fallback) {
        /** @type {Map<number, number>} touching color -> how many touching balls have it */
        const touching = new Map();

        for (const n of this.neighbors(cell.row, cell.col)) {
            const c = this.cells[n.row][n.col];

            if (c !== EMPTY && c !== STONE) {
                touching.set(c, (touching.get(c) ?? 0) + 1);
            }
        }

        /** @type {Map<number, Cell>} */
        const pop = new Map();

        for (const color of touching.keys()) {
            this.set(cell.row, cell.col, color);

            const g = this.group(cell.row, cell.col);

            if (g.length >= MATCH_MIN) {
                for (const n of g) {
                    pop.set(n.row * 100 + n.col, n);
                }
            }
        }

        if (pop.size > 0) {
            return this.resolve([...pop.values()]);
        }

        const most = [...touching.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

        this.set(cell.row, cell.col, most ? most[0] : fallback);

        return { popped: [], dropped: [] };
    }

    /**
     * Pop these balls, then drop whatever lost its hold.
     *
     * @param {Cell[]} cells
     * @returns {PlaceResult}
     */
    resolve(cells) {
        const popped = this.take(cells);
        const dropped = this.take(this.floating());

        return { popped, dropped };
    }

    /**
     * Every chameleon takes the next of these colors (after its own, wrapping around).
     *
     * @param {number[]} colors
     */
    shiftChameleons(colors) {
        if (colors.length < 2) {
            return;
        }

        this.cells.forEach((cells, row) => {
            cells.forEach((c, col) => {
                if (this.chameleon[row][col]) {
                    const i = colors.indexOf(c);

                    cells[col] = colors[(i + 1) % colors.length];
                }
            });
        });
    }

    /**
     * Push a new row in from the top: every ball moves one row down and keeps its place across.
     *
     * @param {number[]} row colors of the new top row; use nextTopWidth() for its length
     */
    push(row) {
        this.parity = 1 - this.parity;
        this.cells.pop();
        this.chameleon.pop();
        this.cells.unshift([...row]);
        this.chameleon.unshift(new Array(row.length).fill(false));
    }

    /** @returns {number} how many balls the top row holds after the next push */
    nextTopWidth() {
        return rowWidth(0, 1 - this.parity);
    }

    /**
     * Move the whole board down (the ceiling presses in).
     *
     * @param {number} rows how far, in rows; fractions move it smoothly
     */
    descend(rows) {
        this.drop += rows;
    }

    /**
     * Empty these cells and report what was in them.
     *
     * @param {Cell[]} list
     * @returns {Taken[]}
     */
    take(list) {
        return list.map((cell) => {
            const color = this.cells[cell.row][cell.col];

            this.set(cell.row, cell.col, EMPTY);

            return { cell, color };
        });
    }

    /**
     * Breadth-first walk over neighbors that pass the test, starting from the given cells.
     *
     * @param {Cell[]} start
     * @param {(row: number, col: number) => boolean} test
     * @param {number} [maxSteps] how many neighbor steps to go at most
     * @returns {Cell[]}
     */
    flood(start, test, maxSteps = Infinity) {
        const seen = new Set(start.map((n) => n.row * 100 + n.col));
        const queue = start.map((cell) => ({ cell, steps: 0 }));
        /** @type {Cell[]} */
        const result = [];

        while (queue.length > 0) {
            const { cell, steps } = /** @type {{ cell: Cell, steps: number }} */ (queue.shift());

            result.push(cell);

            if (steps >= maxSteps) {
                continue;
            }

            for (const n of this.neighbors(cell.row, cell.col)) {
                const key = n.row * 100 + n.col;

                if (!seen.has(key) && test(n.row, n.col)) {
                    seen.add(key);
                    queue.push({ cell: n, steps: steps + 1 });
                }
            }
        }

        return result;
    }
}
