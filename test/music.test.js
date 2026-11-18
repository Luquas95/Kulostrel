import { expect, test } from 'bun:test';
import { frequency, JINGLES, JinglePlayer, schedule } from '../src/music.js';

test('note numbers turn into the right pitch', () => {
    expect(frequency(69)).toBeCloseTo(440);
    expect(frequency(81)).toBeCloseTo(880);
});

test('notes start one after another and rests take time', () => {
    const notes = schedule(
        {
            bpm: 60,
            notes: [
                [60, 1],
                [null, 1],
                [62, 0.5],
            ],
        },
        60,
    );

    expect(notes.map((n) => n.tick)).toEqual([0, 120]);
    expect(notes[0].seconds).toBeCloseTo(0.9);
});

test('every jingle is short', () => {
    for (const jingle of Object.values(JINGLES)) {
        const beats = jingle.notes.reduce((sum, [, b]) => sum + b, 0);

        expect((beats * 60) / jingle.bpm).toBeLessThan(4);
    }
});

test('the player starts each note once, at its tick', () => {
    /** @type {number[]} */
    const played = [];
    const player = new JinglePlayer(
        (note) => note,
        (clip) => played.push(clip),
    );

    player.start(
        {
            bpm: 60,
            notes: [
                [60, 1],
                [64, 1],
            ],
        },
        10,
    );
    expect(played).toEqual([60]);

    for (let i = 0; i < 20; i++) {
        player.update();
    }

    expect(played).toEqual([60, 64]);
});
