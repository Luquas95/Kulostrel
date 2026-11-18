import { expect, test } from 'bun:test';
import { SCORE_DROP, SCORE_POP } from '../src/config.js';
import { COMBO_MAX, Scoring, TIME_BONUS } from '../src/scoring.js';

test('a shot scores its popped and dropped balls', () => {
    const s = new Scoring();

    expect(s.shot(3, 2)).toBe(3 * SCORE_POP + 2 * SCORE_DROP);
    expect(s.total).toBe(3 * SCORE_POP + 2 * SCORE_DROP);
});

test('popping shots in a row multiply, a miss ends the combo', () => {
    const s = new Scoring();

    expect(s.shot(3, 0)).toBe(3 * SCORE_POP);
    expect(s.shot(3, 0)).toBe(3 * SCORE_POP * 2);
    expect(s.shot(3, 0)).toBe(3 * SCORE_POP * 3);
    expect(s.shot(0, 0)).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.shot(3, 0)).toBe(3 * SCORE_POP);
});

test('the combo multiplier stops growing at COMBO_MAX', () => {
    const s = new Scoring();

    for (let i = 0; i < COMBO_MAX + 3; i++) {
        s.shot(3, 0);
    }

    expect(s.multiplier).toBe(COMBO_MAX);
});

test('the time bonus counts whole seconds left and never goes negative', () => {
    const s = new Scoring();

    expect(s.clear(12.7)).toBe(12 * TIME_BONUS);
    expect(s.clear(-5)).toBe(0);
    expect(s.total).toBe(12 * TIME_BONUS);
});

test('the total runs across levels, a new level resets only its own points and the combo', () => {
    const s = new Scoring();

    s.shot(3, 0);
    s.startLevel();
    expect(s.level).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.total).toBe(3 * SCORE_POP);
    s.reset();
    expect(s.total).toBe(0);
});
