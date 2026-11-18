// Kulostrel - the ball grid.
//
// Pure game logic with no engine calls, so it can be unit-tested (`bun test`).
//
// The grid is a hex layout stored as rows. Even rows hold COLS balls; odd rows are shifted right by half a ball and
// hold COLS - 1. A cell holds a color number (0, 1, 2, ...) or EMPTY. Row 0 hangs from the ceiling.

import { BALL, COLS, FIELD_TOP, FIELD_X, MATCH_MIN, MAX_ROWS, RADIUS, ROW_H } from './config.js';

export const EMPTY = -1;

/** @typedef {{ row: number, col: number }} Cell */

/**
 * @param {number} row
 * @returns {number} how many cells this row has
 */
export function rowWidth(row) {
    return row % 2 === 0 ? COLS : COLS - 1;
}

/**
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
export function isInside(row, col) {
    return row >= 0 && row < MAX_ROWS && col >= 0 && col < rowWidth(row);
}

// Neighbor offsets [row, col]. In an even row the rows above and below reach left; in an odd row they reach right.
const NEIGHBORS_EVEN = [
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 0],
    [1, -1],
    [1, 0],
];
const NEIGHBORS_ODD = [
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
 * @returns {Cell[]} the cells that touch this one and exist on the board
 */
export function neighbors(row, col) {
    const offsets = row % 2 === 0 ? NEIGHBORS_EVEN : NEIGHBORS_ODD;
    /** @type {Cell[]} */
    const result = [];

    for (const [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;

        if (isInside(r, c)) {
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
 * @returns {{ x: number, y: number }}
 */
export function cellCenter(row, col, drop) {
    return {
        x: FIELD_X + RADIUS + col * BALL + (row % 2 === 0 ? 0 : RADIUS),
        y: FIELD_TOP + RADIUS + (row + drop) * ROW_H,
    };
}

export class Board {
    /** @type {number[][]} */
    cells = [];

    /** How far the ceiling has moved down, in rows. Grows smoothly, so it is usually a fraction. */
    drop = 0;

    constructor() {
        this.clear();
    }

    clear() {
        this.cells = [];

        for (let row = 0; row < MAX_ROWS; row++) {
            this.cells.push(new Array(rowWidth(row)).fill(EMPTY));
        }

        this.drop = 0;
    }

    /**
     * Fill the board from a level layout: one string per row, one character per cell. '.' is empty, a digit is a
     * color. Spaces are ignored, so layouts can be indented to show the hex shift. Missing cells stay empty.
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
        return isInside(row, col) ? this.cells[row][col] : EMPTY;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {number} color
     */
    set(row, col, color) {
        this.cells[row][col] = color;
    }

    /** @returns {boolean} true when no ball is left */
    isEmpty() {
        return this.cells.every((row) => row.every((c) => c === EMPTY));
    }

    /** @returns {number[]} the colors still on the board, sorted */
    colorsLeft() {
        const set = new Set();

        for (const row of this.cells) {
            for (const c of row) {
                if (c !== EMPTY) {
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
     * An empty cell can take a ball if it hangs from the ceiling (row 0) or touches another ball.
     *
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    canHold(row, col) {
        if (!isInside(row, col) || this.cells[row][col] !== EMPTY) {
            return false;
        }

        return row === 0 || neighbors(row, col).some((n) => this.cells[n.row][n.col] !== EMPTY);
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
            for (let col = 0; col < rowWidth(Math.max(row, 0)); col++) {
                if (!this.canHold(row, col)) {
                    continue;
                }

                const c = cellCenter(row, col, this.drop);
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
     * All balls of the same color connected to this cell, the cell included.
     *
     * @param {number} row
     * @param {number} col
     * @returns {Cell[]}
     */
    group(row, col) {
        const color = this.get(row, col);

        if (color === EMPTY) {
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

        for (let col = 0; col < rowWidth(0); col++) {
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
     * @returns {{ popped: { cell: Cell, color: number }[], dropped: { cell: Cell, color: number }[] }}
     */
    place(cell, color) {
        this.set(cell.row, cell.col, color);

        const g = this.group(cell.row, cell.col);

        if (g.length < MATCH_MIN) {
            return { popped: [], dropped: [] };
        }

        const popped = this.take(g);
        const dropped = this.take(this.floating());

        return { popped, dropped };
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
     * @returns {{ cell: Cell, color: number }[]}
     */
    take(list) {
        return list.map((cell) => {
            const color = this.cells[cell.row][cell.col];

            this.cells[cell.row][cell.col] = EMPTY;

            return { cell, color };
        });
    }

    /**
     * Breadth-first walk over neighbors that pass the test, starting from the given cells.
     *
     * @param {Cell[]} start
     * @param {(row: number, col: number) => boolean} test
     * @returns {Cell[]}
     */
    flood(start, test) {
        const seen = new Set(start.map((n) => n.row * 100 + n.col));
        const queue = [...start];
        /** @type {Cell[]} */
        const result = [];

        while (queue.length > 0) {
            const cell = /** @type {Cell} */ (queue.shift());

            result.push(cell);

            for (const n of neighbors(cell.row, cell.col)) {
                const key = n.row * 100 + n.col;

                if (!seen.has(key) && test(n.row, n.col)) {
                    seen.add(key);
                    queue.push(n);
                }
            }
        }

        return result;
    }
}
