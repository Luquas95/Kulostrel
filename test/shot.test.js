import { describe, expect, test } from 'bun:test';
import { Board, cellCenter } from '../src/board.js';
import { FIELD_TOP, FIELD_W, FIELD_X, LAUNCH_X, LAUNCH_Y, RADIUS } from '../src/config.js';
import { Shot, tracePath } from '../src/shot.js';

/**
 * @param {Shot} shot
 * @param {Board} board
 * @returns {number} updates until the shot hits something
 */
function fly(shot, board) {
    for (let i = 1; i < 1000; i++) {
        if (shot.advance(board)) {
            return i;
        }
    }

    throw new Error('the shot never landed');
}

describe('Shot', () => {
    test('straight up reaches the ceiling of an empty board', () => {
        const board = new Board();
        const shot = new Shot(LAUNCH_X, LAUNCH_Y, 0);

        fly(shot, board);
        expect(shot.y - RADIUS).toBeLessThanOrEqual(FIELD_TOP + 0.01);
        expect(shot.x).toBeCloseTo(LAUNCH_X, 5);
        expect(board.snap(shot.x, shot.y)?.row).toBe(0);
    });

    test('stops when it touches a ball', () => {
        const board = new Board();

        board.load(['. . . . . . . 0']);

        const target = cellCenter(0, 7, 0);
        const shot = new Shot(target.x - 1, LAUNCH_Y, 0);

        fly(shot, board);
        expect(shot.y).toBeGreaterThan(target.y + 6);
        expect(board.snap(shot.x, shot.y)).toEqual({ row: 1, col: 6 });
    });

    test('bounces off the side walls and stays inside', () => {
        const board = new Board();
        const shot = new Shot(LAUNCH_X, LAUNCH_Y, -70);
        let bounced = false;

        for (let i = 0; i < 1000 && !shot.advance(board); i++) {
            if (shot.vx > 0) {
                bounced = true;
            }

            expect(shot.x).toBeGreaterThanOrEqual(FIELD_X + RADIUS);
            expect(shot.x).toBeLessThanOrEqual(FIELD_X + FIELD_W - RADIUS);
        }

        expect(bounced).toBe(true);
    });

    test('the aim guide stops at the first ball', () => {
        const board = new Board();

        board.load(['', '', '', '', '', '', '0 0 0 0 0 0 0 0 0 0 0 0 0 0']);

        const ballY = cellCenter(6, 0, 0).y;
        const points = tracePath(board, LAUNCH_X, LAUNCH_Y, 0, 1, 2);

        expect(points.length).toBeGreaterThan(0);
        expect(points.every((p) => p.y > ballY)).toBe(true);
    });
});
