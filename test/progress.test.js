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
    test('starts with the first level unlocked and no best score', () => {
        const p = new Progress(10, memoryStorage());

        expect(p.unlocked).toBe(1);
        expect(p.top).toBe(0);
    });

    test('completing a level unlocks the next, the best score is kept, both survive a reload', () => {
        const storage = memoryStorage();
        const p = new Progress(10, storage);

        p.complete(0);
        expect(p.record(300)).toBe(true);
        expect(p.record(200)).toBe(false);

        const again = new Progress(10, storage);

        expect(again.unlocked).toBe(2);
        expect(again.top).toBe(300);
    });

    test('a lost game locks everything again but keeps the best score', () => {
        const storage = memoryStorage();
        const p = new Progress(10, storage);

        p.complete(0);
        p.complete(1);
        p.record(400);
        p.restart();

        const again = new Progress(10, storage);

        expect(again.unlocked).toBe(1);
        expect(again.top).toBe(400);
    });

    test('never unlocks past the last level', () => {
        const p = new Progress(3, memoryStorage());

        p.complete(2);
        expect(p.unlocked).toBe(3);
    });

    test('ignores broken saved data', () => {
        const storage = memoryStorage();

        storage.setItem('kulostrel.progress.v1', '{not json');
        expect(new Progress(5, storage).unlocked).toBe(1);

        storage.setItem('kulostrel.progress.v1', JSON.stringify({ unlocked: 99, top: 'x' }));

        const p = new Progress(5, storage);

        expect(p.unlocked).toBe(5);
        expect(p.top).toBe(0);
    });

    test('works without any storage', () => {
        const p = new Progress(5, null);

        p.complete(0);
        expect(p.unlocked).toBe(2);
    });
});
