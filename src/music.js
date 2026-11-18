// Kulostrel - short jingles.
//
// BLIT386 synthesizes one tone per clip, so a jingle is a list of notes: every note is rendered once as its own clip
// and JinglePlayer starts them at the right update. Notes are MIDI numbers (60 = middle C); a rest is null.

/** @typedef {[note: number | null, beats: number]} Note */

/** @type {Record<'start' | 'won' | 'lost' | 'finale', { bpm: number, notes: Note[] }>} */
export const JINGLES = {
    // The game starts: a bright rising call.
    start: {
        bpm: 168,
        notes: [
            [72, 0.5],
            [76, 0.5],
            [79, 0.5],
            [84, 1],
            [79, 0.5],
            [81, 0.5],
            [84, 1.5],
        ],
    },
    // A level is cleared.
    won: {
        bpm: 200,
        notes: [
            [79, 0.5],
            [84, 0.5],
            [88, 0.5],
            [null, 0.25],
            [86, 0.25],
            [88, 1.5],
        ],
    },
    // The balls crossed the line.
    lost: {
        bpm: 120,
        notes: [
            [67, 0.75],
            [66, 0.75],
            [65, 0.75],
            [64, 2],
        ],
    },
    // Every tenth level is cleared.
    finale: {
        bpm: 180,
        notes: [
            [72, 0.5],
            [76, 0.5],
            [79, 0.5],
            [84, 0.5],
            [79, 0.5],
            [84, 0.5],
            [88, 0.5],
            [91, 2],
        ],
    },
};

/**
 * @param {number} note MIDI number
 * @returns {number} frequency in Hz
 */
export function frequency(note) {
    return 440 * 2 ** ((note - 69) / 12);
}

/**
 * When each note starts, in updates from the start of the jingle, and how long it sounds in seconds.
 *
 * @param {{ bpm: number, notes: Note[] }} jingle
 * @param {number} fps updates per second
 * @returns {{ tick: number, note: number, seconds: number }[]} rests are left out
 */
export function schedule(jingle, fps) {
    const beat = 60 / jingle.bpm;
    /** @type {{ tick: number, note: number, seconds: number }[]} */
    const out = [];
    let time = 0;

    for (const [note, beats] of jingle.notes) {
        if (note !== null) {
            // A little shorter than the full length, so repeated notes stay separate.
            out.push({ tick: Math.round(time * fps), note, seconds: Math.round(beats * beat * 0.9 * 1000) / 1000 });
        }

        time += beats * beat;
    }

    return out;
}

/**
 * Plays one jingle at a time; a new one replaces the old.
 *
 * @template Clip
 */
export class JinglePlayer {
    /** @type {{ tick: number, note: number, seconds: number }[]} */
    queue = [];
    tick = 0;

    /**
     * @param {(note: number, seconds: number) => Clip | null} clipFor the rendered clip for a note, if there is one
     * @param {(clip: Clip) => void} play
     */
    constructor(clipFor, play) {
        this.clipFor = clipFor;
        this.play = play;
    }

    /**
     * @param {{ bpm: number, notes: Note[] }} jingle
     * @param {number} fps
     */
    start(jingle, fps) {
        this.queue = schedule(jingle, fps);
        this.tick = 0;
        this.update();
    }

    /** Call once per update: starts the notes that are due. */
    update() {
        while (this.queue.length > 0 && this.queue[0].tick <= this.tick) {
            const { note, seconds } = /** @type {{ note: number, seconds: number }} */ (this.queue.shift());
            const clip = this.clipFor(note, seconds);

            if (clip !== null) {
                this.play(clip);
            }
        }

        this.tick += 1;
    }
}
