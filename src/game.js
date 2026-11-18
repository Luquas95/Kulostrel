// Kulostrel - a ball shooter for BLIT386.
//
// Aim the launcher, shoot a ball into the cluster hanging from the ceiling. Three or more balls of the same color pop;
// balls that lose their hold fall. The balls creep down all the time. Clear the board to win the level; let
// a ball cross the line above the launcher and the game is over.
//
// Controls
//   Left / Right (or A / D)   aim; tap for a small step, hold to turn
//   Space, Up (or W), click   shoot
//   Down (or S)               swap the current and the next ball
//   Mouse                     aim at the pointer
//   Escape                    back to the title screen
//
// Levels never end (levels.js): from level 11 special balls join one at a time, each introduced on a card (chameleons,
// bombs, rainbow balls, stones), and from level 21 rows are pushed in from the top too. The field shows how many rows
// are still to come (+n) and the dots under it how many shots are left until the next one.
//
// The title screen picks a level (Left / Right) among the unlocked ones. Clearing a level unlocks the next one; the
// best score of a whole game is saved (progress.js). Losing a level ends the game: everything locks again and play
// restarts at level 1. Scoring (points, combo, time bonus) lives in scoring.js, jingles in music.js.
//
// The game logic lives in board.js (the grid) and shot.js (the flying ball); this file reads input, keeps the game
// state and draws. Testing tip: `?seed=42` in the address gives the same ball order every run, and
// `BT.testState()` in the browser console shows the state as plain numbers.

import { AudioClip, BT, bootstrap, Color32, Rect2i, SpriteSheet, Vector2i } from 'blit386';
import { Board, EMPTY, STONE } from './board.js';
import {
    AIM_LIMIT,
    AIM_SPEED,
    BALL,
    DEATH_Y,
    FIELD_TOP,
    FIELD_W,
    FIELD_X,
    LAUNCH_X,
    LAUNCH_Y,
    RADIUS,
    ROW_H,
    SCREEN_H,
    SCREEN_W,
} from './config.js';
import { generateLayout, generatePushRow, levelAt } from './levels.js';
import { frequency, JINGLES, JinglePlayer } from './music.js';
import { Progress } from './progress.js';
import { Scoring } from './scoring.js';
import { Shot, tracePath } from './shot.js';

// Palette slots for the scene.
const C_BG = 1;
const C_FIELD = 2;
const C_WALL = 3;
const C_TEXT = 4;
const C_DIM = 5;
const C_GUIDE = 6;
const C_DANGER = 7;
const C_LAUNCHER = 8;

// Ball colors: each takes four slots starting at BALL_SLOTS (rim, body, highlight, soft edge).
const BALL_SLOTS = 16;

/** The play field's color; ball edges blend into it. */
const FIELD_RGB = new Color32(24, 28, 50);
const BALL_COLORS = [
    [220, 50, 60], // 0 red
    [245, 200, 50], // 1 yellow
    [70, 190, 80], // 2 green
    [60, 120, 235], // 3 blue
    [170, 80, 215], // 4 purple
    [60, 205, 210], // 5 cyan
];
// Balls that are not one of the colors. They follow the colors in the palette; STONE (9) comes from board.js.
const FLASH = 6; // white, for the flash when balls pop
const BOMB = 7;
const RAINBOW = 8;
const EXTRA_COLORS = [
    [240, 240, 250], // 6 flash
    [70, 70, 90], // 7 bomb
    [240, 240, 250], // 8 rainbow (drawn in changing colors; this slot is unused)
    [150, 145, 135], // 9 stone
];

/** Any level number can be unlocked; this only keeps the saved number sane. */
const LEVEL_LIMIT = 9999;

/**
 * What the card before a level says when it brings something new: the ball to show, a name, up to three lines.
 *
 * @type {Record<import('./levels.js').Intro, { ball: number, name: string, lines: string[] }>}
 */
const INTROS = {
    chameleon: { ball: -1, name: 'KAMELEON', lines: ['PO KAZDE RANE', 'ZMENI BARVU.', 'POZNAS HO PO OKU.'] },
    bomb: { ball: BOMB, name: 'BOMBA', lines: ['ROZBIJE VSECHNO', 'KOLEM SEBE,', 'I KAMENY.'] },
    rainbow: { ball: RAINBOW, name: 'DUHOVA KULICKA', lines: ['PASUJE KE KAZDE', 'BARVE, KTERE SE', 'DOTKNE.'] },
    stone: { ball: STONE, name: 'KAMEN', lines: ['NEDA SE ROZBIT.', 'SHOD HO, NEBO', 'ODPAL BOMBOU.'] },
    push: { ball: -2, name: 'TLAK SHORA', lines: ['PRIBYVAJI RADY.', '+3: KOLIK JESTE,', 'TECKY: RAN DO DALSI'] },
};

/** How long a key must be held before aiming turns continuously (ticks). Longer than a legacy terminal tap. */
const AIM_HOLD_DELAY = 36;
/** Degrees per tap. */
const AIM_TAP = 2;

/** Frames a popped ball flashes before it disappears. */
const POP_FRAMES = 8;
/** Gravity for falling balls, pixels per update squared. */
const GRAVITY = 0.25;

// The ball sprite, 6 x 6. 0 transparent, 1 rim, 2 body, 3 highlight.
// 4 is a soft edge, half rim and half background, so the 6x6 ball reads as round rather than as a square.
const BALL_PIXELS = ['.4114.', '413324', '132221', '122221', '412214', '.4114.'];

// Marks drawn over a special ball, 6 x 8: two rows above the ball (for the bomb's fuse), then the ball's 6 x 6.
// They are a second sprite rather than single pixels, because the WebGPU backend draws pixels and rectangles before
// sprites whatever the call order. Letters are palette slots: w text white, k background, f fuse, s spark, g spark.
const MARK_W = BALL;
const MARK_H = BALL + 2;
const MARKS = {
    eye: ['......', '......', '......', '......', '..ww..', '...k..', '......', '......'],
    stone: ['......', '......', '......', '......', '..k.k.', '...k..', '......', '......'],
    rainbow: ['......', '......', '......', '......', '..w...', '...w..', '......', '......'],
    fuse: ['.....s', '....f.', '......', '......', '......', '......', '......', '......'],
    fuse2: ['.....g', '....f.', '......', '......', '......', '......', '......', '......'],
};
/** @type {(keyof typeof MARKS)[]} */
const MARK_ORDER = ['eye', 'stone', 'rainbow', 'fuse', 'fuse2'];

/** @typedef {{ x: number, y: number, vy: number, color: number, timer: number, falling: boolean }} Effect */

/**
 * Palette offset that draws the ball sprite in the given color.
 *
 * @param {number} color
 * @returns {number}
 */
function ballOffset(color) {
    return BALL_SLOTS + color * 4 - 1;
}

/** @returns {number | null} the `?seed=` from the address, if it is a whole number */
function readSeed() {
    const raw = new URLSearchParams(window.location.search).get('seed');
    const seed = raw === null ? Number.NaN : Number(raw);

    return Number.isSafeInteger(seed) ? seed : null;
}

/**
 * @param {Color32} a
 * @param {Color32} b
 * @param {number} t 0 = a, 1 = b
 * @returns {Color32}
 */
function mix(a, b, t) {
    const k = (/** @type {number} */ x, /** @type {number} */ y) => Math.round(x * (1 - t) + y * t);

    return new Color32(k(a.r, b.r), k(a.g, b.g), k(a.b, b.b));
}

/**
 * @param {Color32} c
 * @param {number} f brightness factor
 * @returns {Color32}
 */
function shade(c, f) {
    const k = (/** @type {number} */ v) => Math.max(0, Math.min(255, Math.round(v * f)));

    return new Color32(k(c.r), k(c.g), k(c.b));
}

class Game {
    board = new Board();
    levelIndex = 0;

    /** @type {'title' | 'intro' | 'aim' | 'fly' | 'won' | 'lost'} */
    state = 'title';

    /** Saved progress; created in init() so storage is only touched once the page runs. */
    progress = new Progress(LEVEL_LIMIT, null);

    /** The current level's setting. */
    level = levelAt(0);

    /** Rows still to be pushed in from the top in this level. */
    pushesLeft = 0;

    /** Shots until the next row comes in. */
    shotsToPush = 0;

    /** Pixels the board is still drawn above its place, so a pushed row slides in. */
    pushAnim = 0;

    /** The level picked on the title screen. */
    menuIndex = 0;

    /** True when the score just reached beat the saved best. */
    isNewBest = false;

    scoring = new Scoring();

    /** Updates spent in the current level, for its clock. */
    levelTicks = 0;

    /** The time bonus of the level just cleared. */
    bonus = 0;

    /** @type {Map<string, AudioClip>} one rendered clip per jingle note */
    noteClips = new Map();

    jingle = new JinglePlayer(
        (/** @type {number} */ note, /** @type {number} */ seconds) => this.noteClips.get(`${note}/${seconds}`) ?? null,
        (/** @type {AudioClip} */ clip) => BT.soundPlay(clip, { volume: 0.5 }),
    );

    /** Degrees from straight up, positive to the right. */
    aim = 0;
    aimHeld = 0;
    isMouseAim = false;

    current = 0;
    next = 0;

    /** @type {Shot | null} */
    shot = null;

    /** @type {Effect[]} */
    effects = [];

    /** @type {{ x: number, y: number }[]} */
    guide = [];

    /** @type {SpriteSheet | null} */
    ballSheet = null;
    ballRect = new Rect2i(0, 0, BALL, BALL);

    /** @type {SpriteSheet | null} the marks on special balls, side by side in MARK_ORDER */
    markSheet = null;
    markRect = new Rect2i(0, 0, MARK_W, MARK_H);

    /** @type {Record<string, AudioClip | null>} */
    sounds = { shoot: null, pop: null, drop: null, stick: null, boom: null, push: null };

    // Reused every frame so render() does not allocate.
    pos = new Vector2i(0, 0);
    rect = new Rect2i(0, 0, 0, 0);
    pointer = new Vector2i(0, 0);
    pointerDelta = new Vector2i(0, 0);

    configure() {
        return {
            displaySize: new Vector2i(SCREEN_W, SCREEN_H),
            keyboardLayout: /** @type {const} */ ('single'), // arrows and WASD both aim
            isCapturingKeyboardScroll: true,
        };
    }

    async init() {
        const palette = BT.paletteCreate(64);

        palette.set(C_BG, new Color32(14, 16, 30));
        palette.set(C_FIELD, FIELD_RGB);
        palette.set(C_WALL, new Color32(80, 90, 130));
        palette.set(C_TEXT, new Color32(235, 240, 255));
        palette.set(C_DIM, new Color32(130, 140, 175));
        palette.set(C_GUIDE, new Color32(150, 160, 200));
        palette.set(C_DANGER, new Color32(230, 70, 70));
        palette.set(C_LAUNCHER, new Color32(170, 180, 215));

        [...BALL_COLORS, ...EXTRA_COLORS].forEach(([r, g, b], i) => {
            const base = new Color32(r, g, b);
            const slot = BALL_SLOTS + i * 4;

            palette.set(slot, shade(base, 0.55));
            palette.set(slot + 1, base);
            palette.set(slot + 2, shade(base, 1.45));
            palette.set(slot + 3, mix(shade(base, 0.55), FIELD_RGB, 0.5));
        });

        BT.paletteSet(palette);

        const pixels = new Uint8Array(BALL * BALL);

        BALL_PIXELS.forEach((line, y) => {
            for (let x = 0; x < BALL; x++) {
                pixels[y * BALL + x] = line[x] === '.' ? 0 : Number(line[x]);
            }
        });
        this.ballSheet = SpriteSheet.fromIndexedPixels(BALL, BALL, pixels);

        const slots = { w: C_TEXT, k: C_BG, f: C_LAUNCHER, s: C_DANGER, g: C_GUIDE };
        const markW = MARK_W * MARK_ORDER.length;
        const marks = new Uint8Array(markW * MARK_H);

        MARK_ORDER.forEach((name, i) => {
            MARKS[name].forEach((line, y) => {
                for (let x = 0; x < MARK_W; x++) {
                    const ch = /** @type {keyof typeof slots} */ (line[x]);

                    marks[y * markW + i * MARK_W + x] = slots[ch] ?? 0;
                }
            });
        });
        this.markSheet = SpriteSheet.fromIndexedPixels(markW, MARK_H, marks);

        const seed = readSeed();

        if (seed !== null) {
            BT.randomSeed(seed);
        }

        await this.loadSounds();

        this.progress = new Progress(LEVEL_LIMIT);
        this.menuIndex = this.progress.unlocked - 1;
        this.state = 'title';

        return true;
    }

    async loadSounds() {
        // Sound is a bonus: in a terminal without audio, or if synthesis fails, the game plays silently.
        try {
            this.sounds.shoot = await AudioClip.synth(BT.synthPreset.blip(1));
            this.sounds.stick = await AudioClip.synth(BT.synthPreset.hit(2));
            this.sounds.pop = await AudioClip.synth(BT.synthPreset.pickup(3));
            this.sounds.drop = await AudioClip.synth(BT.synthPreset.pickup(7));
            this.sounds.boom = await AudioClip.synth(BT.synthPreset.explosion(4));
            this.sounds.push = await AudioClip.synth(BT.synthPreset.hit(9));

            for (const jingle of Object.values(JINGLES)) {
                const beat = 60 / jingle.bpm;

                for (const [note, beats] of jingle.notes) {
                    const seconds = Math.round(beats * beat * 0.9 * 1000) / 1000;
                    const key = `${note}/${seconds}`;

                    if (note !== null && !this.noteClips.has(key)) {
                        const clip = await AudioClip.synth({
                            waveform: 'square',
                            frequency: frequency(note),
                            duration: seconds,
                            volume: 0.35,
                            dutyCycle: 0.25,
                            envelope: {
                                attack: 0.005,
                                decay: 0.08,
                                sustain: 0.6,
                                release: Math.min(0.12, seconds / 2),
                            },
                            seed: 1,
                        });

                        this.noteClips.set(key, clip);
                    }
                }
            }
        } catch (error) {
            console.warn('[kulostrel] sounds unavailable', error);
        }
    }

    /** @param {string} name */
    play(name) {
        const clip = this.sounds[name];

        if (clip) {
            BT.soundPlay(clip);
        }
    }

    /**
     * @param {number} index
     * @param {boolean} isNewGame true to start counting the score from zero
     */
    startLevel(index, isNewGame) {
        const level = levelAt(index);

        if (isNewGame) {
            this.scoring.reset();
            this.jingle.start(JINGLES.start, BT.targetFPS);
        }

        this.scoring.startLevel();
        this.level = level;
        this.levelIndex = index;
        this.pushesLeft = level.pushRows;
        this.shotsToPush = level.pushEvery;
        this.pushAnim = 0;
        this.levelTicks = 0;
        this.bonus = 0;
        this.board.load(generateLayout(level, () => BT.random.next()));
        this.isNewBest = false;
        // A level that brings something new first shows its card; the clock waits for it.
        this.state = level.intro ? 'intro' : 'aim';
        this.shot = null;
        this.effects = [];
        this.aim = 0;
        this.current = this.pickBall();
        this.next = this.pickBall();
    }

    /** @returns {number} a color that is still on the board, so the level can always be finished */
    pickColor() {
        const colors = this.board.colorsLeft();

        return colors.length > 0 ? BT.random.pick(colors) : 0;
    }

    /** @returns {number} the ball to hand out next: now and then a bomb or a rainbow ball, else a color */
    pickBall() {
        const r = BT.random.next();

        if (r < this.level.bombs) {
            return BOMB;
        }

        if (r < this.level.bombs + this.level.rainbows) {
            return RAINBOW;
        }

        return this.pickColor();
    }

    /** @returns {number} whole seconds left on the level's clock */
    secondsLeft() {
        return Math.max(0, Math.ceil(this.level.seconds - this.levelTicks / BT.targetFPS));
    }

    update() {
        this.updateEffects();
        this.jingle.update();
        this.pushAnim = Math.max(0, this.pushAnim - 0.5);

        if (this.state === 'title') {
            this.updateTitle();

            return;
        }

        // Escape leaves a level for the title screen at any time.
        if (BT.isKeyPressed('Escape')) {
            this.progress.record(this.scoring.total);
            this.menuIndex = this.levelIndex;
            this.state = 'title';
            this.effects = [];

            return;
        }

        if (this.state === 'intro') {
            if (this.isConfirmPressed()) {
                this.state = 'aim';
            }

            return;
        }

        if (this.state === 'aim' || this.state === 'fly') {
            this.levelTicks += 1;

            // The balls creep down all the time, at the level's pace.
            this.board.descend(1 / (this.level.secondsPerRow * BT.targetFPS));

            if (this.isOverLine()) {
                this.lose();

                return;
            }
        }

        if (this.state === 'aim') {
            this.updateAim();
        } else if (this.state === 'fly') {
            this.updateShot();
        } else if (this.isConfirmPressed()) {
            if (this.state === 'lost') {
                this.startLevel(0, true);
            } else {
                this.startLevel(this.levelIndex + 1, false);
            }
        }
    }

    /** A lost level ends the run: the next game starts again from level 1. */
    lose() {
        this.state = 'lost';
        this.shot = null;
        this.progress.restart();
        this.isNewBest = this.progress.record(this.scoring.total);
        this.menuIndex = 0;
        this.jingle.start(JINGLES.lost, BT.targetFPS);
    }

    updateTitle() {
        const last = this.progress.unlocked - 1;

        if (BT.isPressed(BT.BTN_LEFT, 0)) {
            this.menuIndex = Math.max(0, this.menuIndex - 1);
        }

        if (BT.isPressed(BT.BTN_RIGHT, 0)) {
            this.menuIndex = Math.min(last, this.menuIndex + 1);
        }

        if (this.isConfirmPressed()) {
            // The press is consumed this update; the first shot needs a new one.
            this.startLevel(this.menuIndex, true);
        }
    }

    /** @returns {boolean} */
    isConfirmPressed() {
        return (
            BT.isPressed(BT.BTN_A, 0) ||
            BT.isPressed(BT.BTN_UP, 0) ||
            BT.isKeyPressed('Enter') ||
            BT.isPressed(BT.BTN_POINTER_A, 0)
        );
    }

    updateAim() {
        const left = BT.isDown(BT.BTN_LEFT, 0);
        const right = BT.isDown(BT.BTN_RIGHT, 0);

        if (left || right) {
            const dir = left ? -1 : 1;

            this.isMouseAim = false;

            if (this.aimHeld === 0) {
                this.aim += dir * AIM_TAP;
            } else if (this.aimHeld >= AIM_HOLD_DELAY) {
                this.aim += dir * AIM_SPEED;
            }

            this.aimHeld += 1;
        } else {
            this.aimHeld = 0;
        }

        // The mouse takes over as soon as it moves, and gives way to the keys when they are pressed.
        if (BT.isPointerActive(0)) {
            BT.pointerDeltaTo(this.pointerDelta, 0);

            if (this.pointerDelta.x !== 0 || this.pointerDelta.y !== 0 || BT.isPressed(BT.BTN_POINTER_A, 0)) {
                this.isMouseAim = true;
            }

            if (this.isMouseAim) {
                BT.pointerPosTo(this.pointer, 0);

                const dx = this.pointer.x - LAUNCH_X;
                const dy = Math.min(this.pointer.y - LAUNCH_Y, -1);

                this.aim = (Math.atan2(dx, -dy) * 180) / Math.PI;
            }
        }

        this.aim = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, this.aim));
        this.guide = tracePath(this.board, LAUNCH_X, LAUNCH_Y, this.aim, 1, 4);

        if (BT.isPressed(BT.BTN_DOWN, 0) || BT.isPressed(BT.BTN_POINTER_B, 0)) {
            [this.current, this.next] = [this.next, this.current];
        }

        if (this.isConfirmPressed()) {
            this.shot = new Shot(LAUNCH_X, LAUNCH_Y, this.aim);
            this.state = 'fly';
            this.play('shoot');
        }
    }

    updateShot() {
        const shot = /** @type {Shot} */ (this.shot);

        if (!shot.advance(this.board)) {
            return;
        }

        const cell = this.board.snap(shot.x, shot.y);

        this.shot = null;

        if (cell === null) {
            // Nowhere to stick: only possible with a full board. Treat it as a loss.
            this.lose();

            return;
        }

        const { popped, dropped } = this.placeCurrent(cell);

        for (const { cell: c, color } of popped) {
            this.addEffect(c.row, c.col, color, false);
        }

        for (const { cell: c, color } of dropped) {
            this.addEffect(c.row, c.col, color, true);
        }

        this.scoring.shot(popped.length, dropped.length);

        if (this.current === BOMB) {
            this.play('boom');
        } else if (dropped.length > 0) {
            this.play('drop');
        } else if (popped.length > 0) {
            this.play('pop');
        } else {
            this.play('stick');
        }

        if (this.board.isEmpty()) {
            // Every tenth level gets the big fanfare.
            const isLast = (this.levelIndex + 1) % 10 === 0;

            this.state = 'won';
            this.bonus = this.scoring.clear(this.secondsLeft());
            this.progress.complete(this.levelIndex);
            this.isNewBest = this.progress.record(this.scoring.total);
            this.jingle.start(isLast ? JINGLES.finale : JINGLES.won, BT.targetFPS);

            return;
        }

        this.board.shiftChameleons(this.board.colorsLeft());
        this.countPush();

        if (this.isOverLine()) {
            this.lose();

            return;
        }

        this.current = this.next;

        // A colored ball must be a color that is still on the board.
        const colors = this.board.colorsLeft();

        if (this.current < FLASH && !colors.includes(this.current)) {
            this.current = this.pickColor();
        }

        this.next = this.pickBall();
        this.state = 'aim';
    }

    /**
     * Stick the ball in hand to the board and resolve it.
     *
     * @param {import('./board.js').Cell} cell
     * @returns {import('./board.js').PlaceResult}
     */
    placeCurrent(cell) {
        if (this.current === BOMB) {
            return this.board.placeBomb(cell);
        }

        if (this.current === RAINBOW) {
            return this.board.placeRainbow(cell, this.pickColor());
        }

        return this.board.place(cell, this.current);
    }

    /** One shot closer to the next pushed row; push it in when it is due. */
    countPush() {
        if (this.pushesLeft === 0) {
            return;
        }

        this.shotsToPush -= 1;

        if (this.shotsToPush > 0) {
            return;
        }

        this.board.push(generatePushRow(this.board.nextTopWidth(), this.board.colorsLeft(), () => BT.random.next()));
        this.pushesLeft -= 1;
        this.shotsToPush = this.level.pushEvery;
        this.pushAnim = ROW_H;
        this.play('push');
    }

    /** @returns {boolean} true when the lowest ball reaches the line above the launcher */
    isOverLine() {
        const row = this.board.lowestRow();

        return row >= 0 && this.board.center(row, 0).y + RADIUS > DEATH_Y;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {number} color
     * @param {boolean} falling
     */
    addEffect(row, col, color, falling) {
        const p = this.board.center(row, col);

        this.effects.push({ x: p.x, y: p.y, vy: falling ? -1 : 0, color, timer: POP_FRAMES, falling });
    }

    updateEffects() {
        for (const e of this.effects) {
            if (e.falling) {
                e.vy += GRAVITY;
                e.y += e.vy;
            } else {
                e.timer -= 1;
            }
        }

        this.effects = this.effects.filter((e) => (e.falling ? e.y - RADIUS < SCREEN_H : e.timer > 0));
    }

    render() {
        BT.clear(C_BG);

        if (this.state === 'title') {
            this.renderTitle();

            return;
        }

        // A card or message replaces the game instead of covering it: on the WebGPU backend the engine draws sprites
        // (the balls) after filled rectangles whatever the call order, so a box painted over the field let the balls
        // show through.
        if (this.state === 'intro') {
            this.renderIntro();

            return;
        }

        if (this.state === 'won' || this.state === 'lost') {
            this.renderMessage();

            return;
        }

        this.renderField();
        this.renderBoard();
        this.renderLauncher();
        this.renderEffects();
        this.renderHud();
    }

    renderField() {
        const ceiling = FIELD_TOP + this.board.drop * ROW_H;

        this.fillRect(FIELD_X, 0, FIELD_W, SCREEN_H, C_FIELD);
        this.fillRect(0, 0, FIELD_X, SCREEN_H, C_WALL);
        this.fillRect(FIELD_X + FIELD_W, 0, FIELD_X, SCREEN_H, C_WALL);
        this.fillRect(FIELD_X, 0, FIELD_W, ceiling, C_WALL);

        // The line the balls must not cross. It blinks when the lowest ball is close.
        const row = this.board.lowestRow();
        const isClose = row >= 0 && this.board.center(row, 0).y + RADIUS + 2 * ROW_H > DEATH_Y;
        const color = isClose && Math.floor(BT.ticks / 15) % 2 === 0 ? C_DANGER : C_WALL;

        for (let x = FIELD_X; x < FIELD_X + FIELD_W; x += 4) {
            this.fillRect(x, DEATH_Y, 2, 1, color);
        }
    }

    renderBoard() {
        const { cells } = this.board;

        for (let row = 0; row < cells.length; row++) {
            for (let col = 0; col < cells[row].length; col++) {
                const color = cells[row][col];

                if (color !== EMPTY) {
                    const p = this.board.center(row, col);

                    this.drawBall(p.x, p.y - this.pushAnim, color, this.board.chameleon[row][col]);
                }
            }
        }
    }

    renderLauncher() {
        if (this.state === 'aim') {
            for (const p of this.guide) {
                this.pos.set(Math.floor(p.x), Math.floor(p.y));
                BT.drawPixel(this.pos, C_GUIDE);
            }
        }

        // A short barrel pointing where the shot goes.
        const rad = (this.aim * Math.PI) / 180;
        const tipX = Math.floor(LAUNCH_X + Math.sin(rad) * 7);
        const tipY = Math.floor(LAUNCH_Y - Math.cos(rad) * 7);

        BT.drawLine(new Vector2i(LAUNCH_X, LAUNCH_Y), new Vector2i(tipX, tipY), C_LAUNCHER);
        this.fillRect(LAUNCH_X - 6, LAUNCH_Y + 4, 12, 3, C_LAUNCHER);

        if (this.shot) {
            this.drawBall(this.shot.x, this.shot.y, this.current);
        } else if (this.state === 'aim' || this.state === 'intro') {
            this.drawBall(LAUNCH_X, LAUNCH_Y, this.current);
        }
    }

    renderEffects() {
        for (const e of this.effects) {
            const isFlash = !e.falling && Math.floor(e.timer / 2) % 2 === 0;

            this.drawBall(e.x, e.y, isFlash ? FLASH : e.color);
        }
    }

    renderHud() {
        const x = FIELD_X * 2 + FIELD_W + 1;
        const left = this.secondsLeft();

        BT.systemPrint(new Vector2i(x, 1), C_DIM, 'KOLO');
        BT.systemPrint(new Vector2i(x, 11), C_TEXT, String(this.levelIndex + 1));
        BT.systemPrint(new Vector2i(x, 24), C_DIM, 'SKORE');
        BT.systemPrint(new Vector2i(x, 34), C_TEXT, String(this.scoring.total));
        BT.systemPrint(new Vector2i(x, 47), C_DIM, 'CAS');
        // The clock turns red for the last ten seconds of its bonus.
        BT.systemPrint(new Vector2i(x, 57), left <= 10 ? C_DANGER : C_TEXT, String(left));

        if (this.scoring.combo > 0) {
            BT.systemPrint(new Vector2i(x, 70), C_GUIDE, `x${this.scoring.multiplier}`);
        }

        // The next ball waits beside the launcher.
        this.drawBall(LAUNCH_X - 16, LAUNCH_Y + 2, this.next);
        this.renderPushes();
    }

    /** Bottom right of the field: +n rows still to come, and a dot for every shot until the next one. */
    renderPushes() {
        if (this.pushesLeft === 0) {
            return;
        }

        const x = FIELD_X + FIELD_W - 26;
        // The last shot before a row comes in, the counter blinks.
        const isDue = this.shotsToPush === 1 && Math.floor(BT.ticks / 10) % 2 === 0;

        BT.systemPrint(new Vector2i(x, 67), isDue ? C_TEXT : C_DANGER, `+${this.pushesLeft}`);

        for (let i = 0; i < this.shotsToPush; i++) {
            this.fillRect(x + 1 + i * 3, 77, 2, 2, C_GUIDE);
        }
    }

    renderTitle() {
        const cx = SCREEN_W / 2;

        // A row of balls in every color, gently bobbing, as a header.
        for (let i = 0; i < BALL_COLORS.length; i++) {
            const bob = BT.isReducedMotionPreferred ? 0 : Math.round(Math.sin(BT.ticks / 12 + i) * 2);

            this.drawBall(cx - 20 + i * 8, 7 + bob, i);
        }

        this.printCentered('KULOSTREL', cx, 13, C_TEXT);

        const n = this.menuIndex;
        const level = levelAt(n);
        const canLeft = n > 0;
        const canRight = n < this.progress.unlocked - 1;

        this.printCentered(`KOLO ${n + 1}`, cx, 29, C_TEXT);
        this.printCentered(level.name.toUpperCase(), cx, 41, C_DIM);

        if (canLeft) {
            BT.systemPrint(new Vector2i(10, 29), C_GUIDE, '<');
        }

        if (canRight) {
            BT.systemPrint(new Vector2i(SCREEN_W - 16, 29), C_GUIDE, '>');
        }

        if (this.progress.top > 0) {
            this.printCentered(`REKORD ${this.progress.top}`, cx, 53, C_DIM);
        }

        if (Math.floor(BT.ticks / 30) % 2 === 0) {
            this.printCentered('MEZERNIK = HRAT', cx, 66, C_TEXT);
        }
    }

    renderMessage() {
        const isWon = this.state === 'won';
        const title = isWon ? 'KOLO HOTOVO' : 'KONEC HRY';
        const hint = isWon ? 'MEZERNIK DAL' : 'MEZERNIK OD KOLA 1';
        const cx = SCREEN_W / 2;

        this.renderBox();
        this.printCentered(title, cx, 6, isWon ? C_TEXT : C_DANGER);

        let y = 18;

        if (isWon) {
            this.printCentered(`BODY ${this.scoring.level}`, cx, y, C_DIM);
            this.printCentered(`CAS +${this.bonus}`, cx, y + 10, C_DIM);
            y += 21;
        }

        this.printCentered(`CELKEM ${this.scoring.total}`, cx, y, C_TEXT);

        // Under the total: a new best, or the best to beat.
        if (this.isNewBest) {
            this.printCentered('NOVY REKORD', cx, y + 11, C_GUIDE);
        } else if (this.progress.top > 0) {
            this.printCentered(`REKORD ${this.progress.top}`, cx, y + 11, C_DIM);
        }

        this.printCentered(hint, cx, 63, C_DIM);
    }

    /** The card before a level that brings something new. */
    renderIntro() {
        const intro = INTROS[/** @type {import('./levels.js').Intro} */ (this.level.intro)];
        const cx = SCREEN_W / 2;

        this.renderBox();
        this.printCentered(`KOLO ${this.levelIndex + 1}: NOVINKA`, cx, 6, C_DIM);

        // The ball itself: a chameleon shows its changing colors, the push card a pushed row.
        if (intro.ball === -2) {
            for (let i = 0; i < 5; i++) {
                this.drawBall(cx - 12 + i * 6, 19, i);
            }
        } else if (intro.ball === -1) {
            this.drawBall(cx, 19, Math.floor(BT.ticks / 30) % BALL_COLORS.length, true);
        } else {
            this.drawBall(cx, 19, intro.ball);
        }

        this.printCentered(intro.name, cx, 26, C_TEXT);
        intro.lines.forEach((line, i) => {
            this.printCentered(line, cx, 37 + i * 9, C_DIM);
        });

        if (Math.floor(BT.ticks / 30) % 2 === 0) {
            this.printCentered('MEZERNIK = HRAT', cx, 66, C_GUIDE);
        }
    }

    /** The box the cards and messages sit in; render() draws nothing of the game behind it. */
    renderBox() {
        BT.drawRect(new Rect2i(4, 4, SCREEN_W - 8, 72), C_WALL);
    }

    /**
     * @param {string} text
     * @param {number} cx horizontal center
     * @param {number} y top
     * @param {number} color
     */
    printCentered(text, cx, y, color) {
        const size = BT.systemPrintMeasure(text);

        BT.systemPrint(new Vector2i(Math.floor(cx - size.x / 2), y), color, text);
    }

    /**
     * @param {number} x center
     * @param {number} y center
     * @param {number} color
     * @param {boolean} [isChameleon]
     */
    drawBall(x, y, color, isChameleon = false) {
        // A rainbow ball runs through all the colors.
        const shown = color === RAINBOW ? Math.floor(BT.ticks / 5) % BALL_COLORS.length : color;
        const left = Math.floor(x - RADIUS);
        const top = Math.floor(y - RADIUS);

        this.pos.set(left, top);
        BT.drawSprite(/** @type {SpriteSheet} */ (this.ballSheet), this.ballRect, this.pos, ballOffset(shown));

        /** @type {keyof typeof MARKS | null} */
        let mark = null;

        if (color === RAINBOW) {
            mark = 'rainbow';
        } else if (color === BOMB) {
            // A fuse with a blinking spark.
            mark = BT.ticks % 8 < 4 ? 'fuse' : 'fuse2';
        } else if (color === STONE) {
            mark = 'stone';
        } else if (isChameleon) {
            // An eye: white with a dark pupil.
            mark = 'eye';
        }

        if (mark) {
            this.markRect.set(MARK_ORDER.indexOf(mark) * MARK_W, 0, MARK_W, MARK_H);
            this.pos.set(left, top - 2);
            BT.drawSprite(/** @type {SpriteSheet} */ (this.markSheet), this.markRect, this.pos, 0);
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} color
     */
    fillRect(x, y, w, h, color) {
        this.rect.set(x, y, w, h);
        BT.drawRectFill(this.rect, color);
    }

    // The game as plain numbers for play-testing: `BT.testState()` in the console, or `npx blit play`.
    testState() {
        return {
            state: this.state,
            level: this.levelIndex + 1,
            unlocked: this.progress.unlocked,
            menu: this.menuIndex + 1,
            score: this.scoring.total,
            pushesLeft: this.pushesLeft,
            shotsToPush: this.shotsToPush,
            combo: this.scoring.combo,
            secondsLeft: this.secondsLeft(),
            drop: Math.round(this.board.drop * 100) / 100,
            aim: Math.round(this.aim * 10) / 10,
            current: this.current,
            next: this.next,
            ballsLeft: this.board.cells.flat().filter((c) => c !== EMPTY).length,
            lowestRow: this.board.lowestRow(),
        };
    }
}

bootstrap(Game);
