// Kulostrel - score for one game (a run from the level picked on the title screen until a loss or the last level).
//
// - Every popped ball is worth SCORE_POP, every ball that falls SCORE_DROP.
// - Combo: shots that pop something in a row multiply their points (x1, x2, x3 ... up to COMBO_MAX). A shot that
//   pops nothing ends the combo.
// - Time bonus: each level has a time limit; every second left on it when the level is cleared is worth TIME_BONUS.
//   Running out of time only costs the bonus, the level goes on.
//
// Pure logic with no engine calls, so it can be tested on its own.

import { SCORE_DROP, SCORE_POP } from './config.js';

/** The highest combo multiplier. */
export const COMBO_MAX = 5;

/** Points for each second left on the level's clock. */
export const TIME_BONUS = 10;

export class Scoring {
    /** Points of the whole game so far. */
    total = 0;

    /** Points from shots in the current level (no time bonus). */
    level = 0;

    /** How many shots in a row popped something. */
    combo = 0;

    /** Start a new game. */
    reset() {
        this.total = 0;
        this.startLevel();
    }

    startLevel() {
        this.level = 0;
        this.combo = 0;
    }

    /** @returns {number} the multiplier the next popping shot gets */
    get multiplier() {
        return Math.min(this.combo + 1, COMBO_MAX);
    }

    /**
     * Count one shot.
     *
     * @param {number} popped balls that popped
     * @param {number} dropped balls that fell
     * @returns {number} points the shot earned
     */
    shot(popped, dropped) {
        if (popped === 0) {
            this.combo = 0;

            return 0;
        }

        const points = (popped * SCORE_POP + dropped * SCORE_DROP) * this.multiplier;

        this.combo += 1;
        this.level += points;
        this.total += points;

        return points;
    }

    /**
     * The level is cleared: add the time bonus.
     *
     * @param {number} secondsLeft whole seconds left on the clock
     * @returns {number} the bonus
     */
    clear(secondsLeft) {
        const bonus = Math.max(0, Math.floor(secondsLeft)) * TIME_BONUS;

        this.total += bonus;

        return bonus;
    }
}
