// Kulostrel - a ball shooter for BLIT386.
//
// Aim the launcher, shoot a ball into the cluster hanging from the ceiling. Three or more balls of the same color pop;
// balls that lose their hold fall. Every few shots the ceiling moves down a row. Clear the board to win the level; let
// a ball cross the line above the launcher and the game is over.
//
// Controls
//   Left / Right (or A / D)   aim; tap for a small step, hold to turn
//   Space, Up (or W), click   shoot
//   Down (or S)               swap the current and the next ball
//   Mouse                     aim at the pointer
//   Escape                    back to the title screen
//
// The title screen picks a level (Left / Right) among the unlocked ones. Clearing a level unlocks the next one and
// keeps the best score (progress.js).
//
// The game logic lives in board.js (the grid) and shot.js (the flying ball); this file reads input, keeps the game
// state and draws. Testing tip: `?seed=42` in the address gives the same ball order every run, and
// `BT.testState()` in the browser console shows the state as plain numbers.

import { AudioClip, BT, bootstrap, Color32, Rect2i, SpriteSheet, Vector2i } from 'blit386';
import { Board, cellCenter, EMPTY } from './board.js';
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
    SCORE_DROP,
    SCORE_POP,
    SCREEN_H,
    SCREEN_W,
} from './config.js';
import { LEVELS } from './levels.js';
import { Progress } from './progress.js';
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

// Ball colors: each takes four slots starting at BALL_SLOTS (rim, body, highlight, unused).
const BALL_SLOTS = 16;
const BALL_COLORS = [
    [220, 50, 60], // 0 red
    [245, 200, 50], // 1 yellow
    [70, 190, 80], // 2 green
    [60, 120, 235], // 3 blue
    [170, 80, 215], // 4 purple
    [60, 205, 210], // 5 cyan
];
// A white ball, used for the flash when balls pop.
const FLASH = BALL_COLORS.length;

/** How long a key must be held before aiming turns continuously (ticks). Longer than a legacy terminal tap. */
const AIM_HOLD_DELAY = 36;
/** Degrees per tap. */
const AIM_TAP = 2;

/** Frames a popped ball flashes before it disappears. */
const POP_FRAMES = 8;
/** Gravity for falling balls, pixels per update squared. */
const GRAVITY = 0.25;

// The ball sprite, 8 x 8. 0 transparent, 1 rim, 2 body, 3 highlight.
const BALL_PIXELS = ['..1111..', '.122221.', '12332221', '12322221', '12222221', '12222221', '.122221.', '..1111..'];

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

    /** @type {'title' | 'aim' | 'fly' | 'won' | 'lost'} */
    state = 'title';

    /** Saved progress; created in init() so storage is only touched once the page runs. */
    progress = new Progress(LEVELS.length, null);

    /** The level picked on the title screen. */
    menuIndex = 0;

    /** True when the level just cleared beat the saved best score. */
    isNewBest = false;

    /** Degrees from straight up, positive to the right. */
    aim = 0;
    aimHeld = 0;
    isMouseAim = false;

    current = 0;
    next = 0;

    /** @type {Shot | null} */
    shot = null;

    score = 0;
    shotsLeft = 0;

    /** @type {Effect[]} */
    effects = [];

    /** @type {{ x: number, y: number }[]} */
    guide = [];

    /** @type {SpriteSheet | null} */
    ballSheet = null;
    ballRect = new Rect2i(0, 0, BALL, BALL);

    /** @type {Record<string, AudioClip | null>} */
    sounds = { shoot: null, pop: null, drop: null, stick: null };

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
        palette.set(C_FIELD, new Color32(24, 28, 50));
        palette.set(C_WALL, new Color32(80, 90, 130));
        palette.set(C_TEXT, new Color32(235, 240, 255));
        palette.set(C_DIM, new Color32(130, 140, 175));
        palette.set(C_GUIDE, new Color32(150, 160, 200));
        palette.set(C_DANGER, new Color32(230, 70, 70));
        palette.set(C_LAUNCHER, new Color32(170, 180, 215));

        [...BALL_COLORS, [240, 240, 250]].forEach(([r, g, b], i) => {
            const base = new Color32(r, g, b);
            const slot = BALL_SLOTS + i * 4;

            palette.set(slot, shade(base, 0.55));
            palette.set(slot + 1, base);
            palette.set(slot + 2, shade(base, 1.45));
        });

        BT.paletteSet(palette);

        const pixels = new Uint8Array(BALL * BALL);

        BALL_PIXELS.forEach((line, y) => {
            for (let x = 0; x < BALL; x++) {
                pixels[y * BALL + x] = line[x] === '.' ? 0 : Number(line[x]);
            }
        });
        this.ballSheet = SpriteSheet.fromIndexedPixels(BALL, BALL, pixels);

        const seed = readSeed();

        if (seed !== null) {
            BT.randomSeed(seed);
        }

        await this.loadSounds();

        this.progress = new Progress(LEVELS.length);
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

    /** @param {number} index */
    startLevel(index) {
        const level = LEVELS[index];

        this.levelIndex = index;
        this.board.load(level.layout);
        this.score = 0;
        this.isNewBest = false;
        this.shotsLeft = level.shotsPerDrop;
        this.state = 'aim';
        this.shot = null;
        this.effects = [];
        this.aim = 0;
        this.current = this.pickColor();
        this.next = this.pickColor();
    }

    /** @returns {number} a color that is still on the board, so the level can always be finished */
    pickColor() {
        const colors = this.board.colorsLeft();

        return colors.length > 0 ? BT.random.pick(colors) : 0;
    }

    update() {
        this.updateEffects();

        if (this.state === 'title') {
            this.updateTitle();

            return;
        }

        // Escape leaves a level for the title screen at any time.
        if (BT.isKeyPressed('Escape')) {
            this.menuIndex = this.levelIndex;
            this.state = 'title';
            this.effects = [];

            return;
        }

        if (this.state === 'aim') {
            this.updateAim();
        } else if (this.state === 'fly') {
            this.updateShot();
        } else if (this.isConfirmPressed()) {
            if (this.state === 'lost') {
                this.startLevel(this.levelIndex);
            } else if (this.levelIndex + 1 < LEVELS.length) {
                this.startLevel(this.levelIndex + 1);
            } else {
                // The last level is done: back to the title screen.
                this.menuIndex = this.levelIndex;
                this.state = 'title';
            }
        }
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
            this.startLevel(this.menuIndex);
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
            this.state = 'lost';

            return;
        }

        const { popped, dropped } = this.board.place(cell, this.current);

        for (const { cell: c, color } of popped) {
            this.addEffect(c.row, c.col, color, false);
        }

        for (const { cell: c, color } of dropped) {
            this.addEffect(c.row, c.col, color, true);
        }

        this.score += popped.length * SCORE_POP + dropped.length * SCORE_DROP;

        if (dropped.length > 0) {
            this.play('drop');
        } else if (popped.length > 0) {
            this.play('pop');
        } else {
            this.play('stick');
        }

        if (this.board.isEmpty()) {
            this.state = 'won';
            this.isNewBest = this.progress.complete(this.levelIndex, this.score);

            return;
        }

        this.shotsLeft -= 1;

        if (this.shotsLeft <= 0) {
            this.board.lower();
            this.shotsLeft = LEVELS[this.levelIndex].shotsPerDrop;
        }

        if (this.isOverLine()) {
            this.state = 'lost';

            return;
        }

        this.current = this.next;

        // The next ball must be a color that is still on the board.
        const colors = this.board.colorsLeft();

        if (!colors.includes(this.current)) {
            this.current = this.pickColor();
        }

        this.next = this.pickColor();
        this.state = 'aim';
    }

    /** @returns {boolean} true when the lowest ball reaches the line above the launcher */
    isOverLine() {
        const row = this.board.lowestRow();

        return row >= 0 && cellCenter(row, 0, this.board.drop).y + RADIUS > DEATH_Y;
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {number} color
     * @param {boolean} falling
     */
    addEffect(row, col, color, falling) {
        const p = cellCenter(row, col, this.board.drop);

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

        this.renderField();
        this.renderBoard();
        this.renderLauncher();
        this.renderEffects();
        this.renderHud();

        if (this.state === 'won' || this.state === 'lost') {
            this.renderMessage();
        }
    }

    renderField() {
        const ceiling = FIELD_TOP + this.board.drop * ROW_H;

        this.fillRect(FIELD_X, 0, FIELD_W, SCREEN_H, C_FIELD);
        this.fillRect(0, 0, FIELD_X, SCREEN_H, C_WALL);
        this.fillRect(FIELD_X + FIELD_W, 0, FIELD_X, SCREEN_H, C_WALL);
        this.fillRect(FIELD_X, 0, FIELD_W, ceiling, C_WALL);

        // The line the balls must not cross. It blinks when the lowest ball is close.
        const row = this.board.lowestRow();
        const isClose = row >= 0 && cellCenter(row, 0, this.board.drop).y + RADIUS + 2 * ROW_H > DEATH_Y;
        const color = isClose && Math.floor(BT.ticks / 15) % 2 === 0 ? C_DANGER : C_WALL;

        for (let x = FIELD_X; x < FIELD_X + FIELD_W; x += 4) {
            this.fillRect(x, DEATH_Y, 2, 1, color);
        }
    }

    renderBoard() {
        const { cells, drop } = this.board;

        for (let row = 0; row < cells.length; row++) {
            for (let col = 0; col < cells[row].length; col++) {
                const color = cells[row][col];

                if (color !== EMPTY) {
                    const p = cellCenter(row, col, drop);

                    this.drawBall(p.x, p.y, color);
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
        const tipX = Math.floor(LAUNCH_X + Math.sin(rad) * 9);
        const tipY = Math.floor(LAUNCH_Y - Math.cos(rad) * 9);

        BT.drawLine(new Vector2i(LAUNCH_X, LAUNCH_Y), new Vector2i(tipX, tipY), C_LAUNCHER);
        this.fillRect(LAUNCH_X - 7, LAUNCH_Y + 4, 14, 3, C_LAUNCHER);

        if (this.shot) {
            this.drawBall(this.shot.x, this.shot.y, this.current);
        } else if (this.state === 'aim') {
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
        const x = FIELD_X * 2 + FIELD_W + 3;

        BT.systemPrint(new Vector2i(x, 2), C_DIM, 'KOLO');
        BT.systemPrint(new Vector2i(x, 14), C_TEXT, String(this.levelIndex + 1));
        BT.systemPrint(new Vector2i(x, 32), C_DIM, 'SKORE');
        BT.systemPrint(new Vector2i(x, 44), C_TEXT, String(this.score));
        BT.systemPrint(new Vector2i(x, 62), C_DIM, 'STROP');
        BT.systemPrint(new Vector2i(x, 74), C_TEXT, String(this.shotsLeft));
        BT.systemPrint(new Vector2i(x, 92), C_DIM, 'DALSI');

        if (this.state !== 'lost') {
            this.drawBall(x + 14, 110, this.next);
        }
    }

    renderTitle() {
        const cx = SCREEN_W / 2;

        // A row of balls in every color, gently bobbing, as a header.
        for (let i = 0; i < BALL_COLORS.length; i++) {
            const bob = BT.isReducedMotionPreferred ? 0 : Math.round(Math.sin(BT.ticks / 12 + i) * 2);

            this.drawBall(cx - 25 + i * 10, 14 + bob, i);
        }

        this.printCentered('KULOSTREL', cx, 26, C_TEXT);

        const n = this.menuIndex;
        const level = LEVELS[n];
        const canLeft = n > 0;
        const canRight = n < this.progress.unlocked - 1;

        this.printCentered(`KOLO ${n + 1}/${LEVELS.length}`, cx, 50, C_TEXT);
        this.printCentered(level.name.toUpperCase(), cx, 64, C_DIM);

        if (canLeft) {
            BT.systemPrint(new Vector2i(18, 50), C_GUIDE, '<');
        }

        if (canRight) {
            BT.systemPrint(new Vector2i(SCREEN_W - 24, 50), C_GUIDE, '>');
        }

        const best = this.progress.bestOf(n);

        if (best > 0) {
            this.printCentered(`REKORD ${best}`, cx, 78, C_DIM);
        }

        if (Math.floor(BT.ticks / 30) % 2 === 0) {
            this.printCentered('MEZERNIK = HRAT', cx, 100, C_TEXT);
        }
    }

    renderMessage() {
        const isWon = this.state === 'won';
        const isLast = this.levelIndex + 1 >= LEVELS.length;
        const title = isWon ? (isLast ? 'VSE HOTOVO' : 'KOLO HOTOVO') : 'KONEC HRY';
        const detail = isWon && this.isNewBest ? 'NOVY REKORD' : `SKORE ${this.score}`;
        const hint = isWon ? (isLast ? 'MEZERNIK MENU' : 'MEZERNIK DAL') : 'MEZERNIK ZNOVU';
        const cx = FIELD_X + FIELD_W / 2;

        this.fillRect(FIELD_X + 6, 34, FIELD_W - 12, 48, C_BG);
        BT.drawRect(new Rect2i(FIELD_X + 6, 34, FIELD_W - 12, 48), C_WALL);
        this.printCentered(title, cx, 38, isWon ? C_TEXT : C_DANGER);
        this.printCentered(detail, cx, 52, isWon && this.isNewBest ? C_GUIDE : C_DIM);
        this.printCentered(hint, cx, 66, C_DIM);
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
     */
    drawBall(x, y, color) {
        this.pos.set(Math.floor(x - RADIUS), Math.floor(y - RADIUS));
        BT.drawSprite(/** @type {SpriteSheet} */ (this.ballSheet), this.ballRect, this.pos, ballOffset(color));
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
            score: this.score,
            shotsLeft: this.shotsLeft,
            drop: this.board.drop,
            aim: Math.round(this.aim * 10) / 10,
            current: this.current,
            next: this.next,
            ballsLeft: this.board.cells.flat().filter((c) => c !== EMPTY).length,
            lowestRow: this.board.lowestRow(),
        };
    }
}

bootstrap(Game);
