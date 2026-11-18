// Kulostrel - a flying ball.
//
// Pure logic with no engine calls. The ball moves in small steps so it can never jump over a ball or through a wall,
// bounces off the side walls, and stops when it touches the ceiling or another ball.

import { FIELD_TOP, FIELD_W, FIELD_X, HIT_DIST, RADIUS, ROW_H, SHOT_SPEED } from './config.js';
import { cellCenter, EMPTY } from './board.js';

/** Largest distance the ball moves in one step, in pixels. */
const STEP = 1;

/** @typedef {import('./board.js').Board} Board */

export class Shot {
    x = 0;
    y = 0;
    vx = 0;
    vy = 0;

    /**
     * @param {number} x start center
     * @param {number} y start center
     * @param {number} angle degrees from straight up, positive to the right
     * @param {number} [speed]
     */
    constructor(x, y, angle, speed = SHOT_SPEED) {
        const rad = (angle * Math.PI) / 180;

        this.x = x;
        this.y = y;
        this.vx = Math.sin(rad) * speed;
        this.vy = -Math.cos(rad) * speed;
    }

    /**
     * Move one update forward.
     *
     * @param {Board} board
     * @returns {boolean} true when the ball has hit something and must stick
     */
    advance(board) {
        const dist = Math.hypot(this.vx, this.vy);
        const steps = Math.max(1, Math.ceil(dist / STEP));

        for (let i = 0; i < steps; i++) {
            this.x += this.vx / steps;
            this.y += this.vy / steps;
            this.bounce();

            if (this.isTouching(board)) {
                return true;
            }
        }

        return false;
    }

    /** Reflect off the side walls. */
    bounce() {
        const left = FIELD_X + RADIUS;
        const right = FIELD_X + FIELD_W - RADIUS;

        if (this.x < left) {
            this.x = 2 * left - this.x;
            this.vx = Math.abs(this.vx);
        } else if (this.x > right) {
            this.x = 2 * right - this.x;
            this.vx = -Math.abs(this.vx);
        }
    }

    /**
     * @param {Board} board
     * @returns {boolean} true when the ball touches the ceiling or a ball on the board
     */
    isTouching(board) {
        const ceiling = FIELD_TOP + board.drop * ROW_H;

        if (this.y - RADIUS <= ceiling) {
            return true;
        }

        // Only rows near the ball can touch it.
        const row = Math.round((this.y - FIELD_TOP - RADIUS) / ROW_H - board.drop);

        for (let r = Math.max(0, row - 1); r <= row + 1 && r < board.cells.length; r++) {
            const cells = board.cells[r];

            for (let c = 0; c < cells.length; c++) {
                if (cells[c] === EMPTY) {
                    continue;
                }

                const p = cellCenter(r, c, board.drop);

                if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 < HIT_DIST * HIT_DIST) {
                    return true;
                }
            }
        }

        return false;
    }
}

/**
 * The path a shot would take, for the aim guide: points every few pixels until it would hit something, after at most
 * `maxBounces` wall bounces.
 *
 * @param {Board} board
 * @param {number} x
 * @param {number} y
 * @param {number} angle
 * @param {number} maxBounces
 * @param {number} spacing pixels between points
 * @returns {{ x: number, y: number }[]}
 */
export function tracePath(board, x, y, angle, maxBounces, spacing) {
    const shot = new Shot(x, y, angle, 1);
    /** @type {{ x: number, y: number }[]} */
    const points = [];
    let bounces = 0;
    let travelled = 0;

    // A hard cap keeps a nearly horizontal aim from looping for long.
    for (let i = 0; i < 2000; i++) {
        const before = Math.sign(shot.vx);

        if (shot.advance(board)) {
            break;
        }

        if (Math.sign(shot.vx) !== before) {
            bounces += 1;

            if (bounces > maxBounces) {
                break;
            }
        }

        travelled += 1;

        if (travelled % spacing === 0) {
            points.push({ x: shot.x, y: shot.y });
        }
    }

    return points;
}
