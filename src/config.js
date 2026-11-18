// Kulostrel - shared sizes and tuning knobs.
//
// The screen is 128 x 80 pixels. In a terminal (blit-term) one character cell shows 1 x 2 pixels, so the game needs
// 128 x 40 cells to show every pixel (41 with the status line). A smaller terminal has to shrink the picture, which
// blurs it; 40 rows fit most terminal windows. In a browser the engine scales it up.

/** Screen width and height in pixels. */
export const SCREEN_W = 128;
export const SCREEN_H = 80;

/** Ball diameter and radius in pixels. */
export const BALL = 6;
export const RADIUS = BALL / 2;

/** Balls in an even row. Odd rows are shifted right by half a ball and hold one ball less. */
export const COLS = 14;

/** Vertical distance between row centers. 6 * sqrt(3) / 2 rounded, so balls in a hex grid touch. */
export const ROW_H = 5;

/** The playfield: left wall at FIELD_X, right wall at FIELD_X + FIELD_W. */
export const FIELD_X = 4;
export const FIELD_W = COLS * BALL;

/** The top of row 0 before the ceiling has moved. */
export const FIELD_TOP = 2;

/** A ball whose bottom edge passes this line ends the game. */
export const DEATH_Y = 67;

/** The launcher: where a shot starts (ball center). */
export const LAUNCH_X = FIELD_X + FIELD_W / 2;
export const LAUNCH_Y = 74;

/** How far the aim can tilt from straight up, in degrees. */
export const AIM_LIMIT = 80;

/** Aim speed with the keyboard, in degrees per update while the key is held. */
export const AIM_SPEED = 1.5;

/** Shot speed in pixels per update (60 updates a second). */
export const SHOT_SPEED = 2.8;

/**
 * Two balls touch when their centers are closer than this. Slightly less than a full diameter, so a shot can slip
 * through a gap that looks open.
 */
export const HIT_DIST = BALL - 1;

/** Number of rows the board can hold. Rows past the death line exist only so a losing shot has somewhere to land. */
export const MAX_ROWS = 20;

/** Points for each popped ball and for each ball that falls because it lost its hold. */
export const SCORE_POP = 10;
export const SCORE_DROP = 20;

/** The smallest same-color group that pops. */
export const MATCH_MIN = 3;
