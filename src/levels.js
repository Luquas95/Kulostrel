// Kulostrel - levels.
//
// Each level is a layout plus a few settings. In a layout, one string is one row of balls: a digit is a color
// (see COLOR_NAMES in game.js), '.' is an empty cell. Even rows have 14 cells, odd rows 13 and sit half a ball to
// the right; indenting odd rows by one space shows that shift and is ignored when the layout is read.
//
// shotsPerDrop: after this many shots the ceiling moves down one row.

/** @typedef {{ name: string, shotsPerDrop: number, layout: string[] }} Level */

/** @type {Level[]} */
export const LEVELS = [
    {
        name: 'Prvni kolo',
        shotsPerDrop: 8,
        layout: [
            '0 0 1 1 2 2 3 3 0 0 1 1 2 2',
            ' 0 1 1 2 2 3 3 0 0 1 1 2 2',
            '1 1 2 2 3 3 0 0 1 1 2 2 3 3',
            ' 1 2 2 3 3 0 0 1 1 2 2 3 3',
            '. . 3 3 0 0 . . 2 2 3 3 . .',
        ],
    },
];
