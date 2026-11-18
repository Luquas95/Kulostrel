import { describe, expect, test } from 'bun:test';
import { Progress } from '../src/progress.js';

/** A tiny in-memory stand-in for localStorage. */
function memoryStorage() {
    /** @type {Map<string, string>} */
    const map = new Map();

    return {
        getItem: (/** @type {string} */ k) => map.get(k) ?? null,
        setItem: (/** @type {string} */ k, /** @type {string} */ v) => void map.set(k, v),
        map,
    };
}

describe('Progress', () => {
    test('starts with the first level unlocked', () => {
        const p = new Progress(10, memoryStorage());

        expect(p.unlocked).toBe(1);
        expect(p.bestOf(0)).toBe(0);
    });

    test('completing a level unlocks the next and survives a reload', () => {
        const storage = memoryStorage();
        const p = new Progress(10, storage);

        expect(p.complete(0, 300)).toBe(true);
        expect(p.complete(0, 200)).toBe(false);

        const again = new Progress(10, storage);

        expect(again.unlocked).toBe(2);
        expect(again.bestOf(0)).toBe(300);
    });

    test('never unlocks past the last level', () => {
        const p = new Progress(3, memoryStorage());

        p.complete(2, 10);
        expect(p.unlocked).toBe(3);
    });

    test('ignores broken saved data', () => {
        const storage = memoryStorage();

        storage.setItem('kulostrel.progress.v1', '{not json');
        expect(new Progress(5, storage).unlocked).toBe(1);

        storage.setItem('kulostrel.progress.v1', JSON.stringify({ unlocked: 99, best: [5, 'x', -3] }));

        const p = new Progress(5, storage);

        expect(p.unlocked).toBe(5);
        expect(p.best).toEqual([5, 0, 0]);
    });

    test('works without any storage', () => {
        const p = new Progress(5, null);

        p.complete(0, 10);
        expect(p.unlocked).toBe(2);
    });
});
