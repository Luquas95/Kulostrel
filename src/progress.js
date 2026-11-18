// Kulostrel - saved progress: which levels are unlocked and the best score of a whole game.
//
// The browser keeps it in localStorage. Where there is no storage (a private window, or a terminal through blit-term),
// progress lasts until the game closes; nothing breaks.

const KEY = 'kulostrel.progress.v1';

/** @typedef {{ unlocked: number, top: number }} ProgressData */

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

    /** The best score of a whole game. */
    top = 0;

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

            if (Number.isFinite(data.top) && /** @type {number} */ (data.top) > 0) {
                this.top = /** @type {number} */ (data.top);
            }
        } catch (error) {
            console.warn('[kulostrel] ignoring unreadable saved progress', error);
        }
    }

    save() {
        try {
            this.storage?.setItem(KEY, JSON.stringify({ unlocked: this.unlocked, top: this.top }));
        } catch (error) {
            console.warn('[kulostrel] could not save progress', error);
        }
    }

    /**
     * A cleared level unlocks the next one.
     *
     * @param {number} index
     */
    complete(index) {
        this.unlocked = Math.min(this.levelCount, Math.max(this.unlocked, index + 2));
        this.save();
    }

    /**
     * Keep the game's score if it is the best so far.
     *
     * @param {number} total
     * @returns {boolean} true when it is a new best
     */
    record(total) {
        if (total <= this.top) {
            return false;
        }

        this.top = total;
        this.save();

        return true;
    }

    /** A lost game: lock every level but the first again. The best score stays. */
    restart() {
        this.unlocked = 1;
        this.save();
    }
}
