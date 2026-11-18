// Kulostrel - shared sizes and tuning knobs.
//
// The screen is 160 x 120 pixels. In a terminal (blit-term) that is 160 x 60 character cells, which fits a normal
// window without shrinking; in a browser the engine scales it up.

/** Screen width and height in pixels. */
export const SCREEN_W = 160;
export const SCREEN_H = 120;

/** Ball diameter and radius in pixels. */
export const BALL = 8;
export const RADIUS = BALL / 2;

/** Balls in an even row. Odd rows are shifted right by half a ball and hold one ball less. */
export const COLS = 14;

/** Vertical distance between row centers. 8 * sqrt(3) / 2 rounded, so balls in a hex grid touch. */
export const ROW_H = 7;

/** The playfield: left wall at FIELD_X, right wall at FIELD_X + FIELD_W. */
export const FIELD_X = 4;
export const FIELD_W = COLS * BALL;

/** The top of row 0 before the ceiling has moved. */
export const FIELD_TOP = 2;

/** A ball whose bottom edge passes this line ends the game. */
export const DEATH_Y = 102;

/** The launcher: where a shot starts (ball center). */
export const LAUNCH_X = FIELD_X + FIELD_W / 2;
export const LAUNCH_Y = 112;

/** How far the aim can tilt from straight up, in degrees. */
export const AIM_LIMIT = 80;

/** Aim speed with the keyboard, in degrees per update while the key is held. */
export const AIM_SPEED = 1.5;

/** Shot speed in pixels per update (60 updates a second). */
export const SHOT_SPEED = 3.5;

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
