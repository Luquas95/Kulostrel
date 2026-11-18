// Kulostrel - saved progress: which levels are unlocked and the best score in each.
//
// The browser keeps it in localStorage. Where there is no storage (a private window, or a terminal through blit-term),
// progress lasts until the game closes; nothing breaks.

const KEY = 'kulostrel.progress.v1';

/** @typedef {{ unlocked: number, best: number[] }} ProgressData */

/**
 * @typedef {object} StorageLike
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 */

/** @returns {StorageLike | null} the browser's localStorage, or null when there is none or it is blocked */
function defaultStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

export class Progress {
    /** How many levels can be played (at least the first). */
    unlocked = 1;

    /** @type {number[]} best score per level index */
    best = [];

    /** @type {StorageLike | null} */
    storage;

    /**
     * @param {number} levelCount
     * @param {StorageLike | null} [storage] pass one in tests; defaults to localStorage
     */
    constructor(levelCount, storage = defaultStorage()) {
        this.levelCount = levelCount;
        this.storage = storage;
        this.load();
    }

    load() {
        try {
            const raw = this.storage?.getItem(KEY);

            if (!raw) {
                return;
            }

            /** @type {Partial<ProgressData>} */
            const data = JSON.parse(raw);

            if (Number.isInteger(data.unlocked)) {
                this.unlocked = Math.max(1, Math.min(this.levelCount, /** @type {number} */ (data.unlocked)));
            }

            if (Array.isArray(data.best)) {
                this.best = data.best.slice(0, this.levelCount).map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
            }
        } catch (error) {
            console.warn('[kulostrel] ignoring unreadable saved progress', error);
        }
    }

    save() {
        try {
            this.storage?.setItem(KEY, JSON.stringify({ unlocked: this.unlocked, best: this.best }));
        } catch (error) {
            console.warn('[kulostrel] could not save progress', error);
        }
    }

    /**
     * Record a cleared level: unlock the next one and keep the better score.
     *
     * @param {number} index
     * @param {number} score
     * @returns {boolean} true when the score is a new best
     */
    complete(index, score) {
        const isBest = score > (this.best[index] ?? 0);

        if (isBest) {
            this.best[index] = score;
        }

        this.unlocked = Math.min(this.levelCount, Math.max(this.unlocked, index + 2));
        this.save();

        return isBest;
    }

    /** A lost game: lock every level but the first again. Best scores stay. */
    restart() {
        this.unlocked = 1;
        this.save();
    }

    /**
     * @param {number} index
     * @returns {number}
     */
    bestOf(index) {
        return this.best[index] ?? 0;
    }
}
