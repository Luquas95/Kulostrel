// Kulostrel - levels.
//
// Each level is a layout plus a few settings. In a layout, one string is one row of balls: a digit is a color
// (0 red, 1 yellow, 2 green, 3 blue, 4 purple, 5 cyan), '.' is an empty cell. Even rows have 14 cells, odd rows 13
// and sit half a ball to the right; odd rows are indented by one space to show that shift (spaces are ignored).
//
// secondsPerRow: the balls creep down all the time; this is how many seconds they take to move one row.
//
// Difficulty grows through the list: more colors (3 -> 6), deeper layouts, a faster descent, and
// shapes that need bank shots. test/levels.test.js checks every layout (row lengths, nothing floating, room to play).

/** @typedef {{ name: string, secondsPerRow: number, layout: string[] }} Level */

/** @type {Level[]} */
export const LEVELS = [
    {
        name: 'Prvni kroky',
        secondsPerRow: 12,
        layout: ['0 0 0 0 1 1 1 1 1 1 2 2 2 2', ' 0 0 0 1 1 1 1 1 2 2 2 2 2', '2 2 2 . . 0 0 0 0 . . 1 1 1'],
    },
    {
        name: 'Schody',
        secondsPerRow: 11,
        layout: [
            '0 0 1 1 2 2 0 0 1 1 2 2 0 0',
            ' 0 1 1 2 2 0 0 1 1 2 2 0 0',
            '1 1 2 2 0 0 1 1 2 2 0 0 1 1',
            ' 1 2 2 0 0 1 1 2 2 0 0 1 1',
            '2 2 0 0 . . . . . . 2 2 0 0',
        ],
    },
    {
        name: 'Ctyri barvy',
        secondsPerRow: 11,
        layout: [
            '0 0 0 1 1 1 2 2 2 3 3 3 0 0',
            ' 0 0 1 1 1 2 2 2 3 3 3 0 0',
            '3 3 . 0 0 . 1 1 . 2 2 . 3 3',
            ' 3 . 0 0 . . 1 1 . 2 2 . 3',
        ],
    },
    {
        name: 'Kosoctverec',
        secondsPerRow: 10,
        layout: [
            '1 1 2 2 3 3 0 0 3 3 2 2 1 1',
            ' 1 2 2 3 3 0 0 0 3 3 2 2 1',
            '. . 2 3 3 0 1 1 0 3 3 2 . .',
            ' . . 3 3 0 1 1 1 0 3 3 . .',
            '. . . . 0 2 2 2 2 0 . . . .',
            ' . . . . 0 2 2 2 0 . . . .',
            '. . . . . . 3 3 . . . . . .',
        ],
    },
    {
        name: 'Pet barev',
        secondsPerRow: 10,
        layout: [
            '0 0 1 1 2 2 3 3 4 4 0 0 1 1',
            ' 0 1 1 2 2 3 3 4 4 0 0 1 1',
            '4 4 0 0 1 1 2 2 3 3 4 4 0 0',
            ' 4 0 0 1 1 2 2 3 3 4 4 0 0',
            '2 2 . . 4 4 . . 0 0 . . 3 3',
        ],
    },
    {
        name: 'Okna',
        secondsPerRow: 9,
        layout: [
            '4 4 4 4 4 4 4 4 4 4 4 4 4 4',
            ' 0 0 . . 1 1 . 2 2 . . 3 3',
            '0 0 0 . 1 1 1 2 2 2 . 3 3 3',
            ' 0 0 . 1 1 . 2 2 . 3 3 . 3',
            '1 . 0 0 . 2 2 . 3 3 . 0 0 .',
            ' 2 2 . . 3 3 . . 4 4 . . 0',
        ],
    },
    {
        name: 'Sest barev',
        secondsPerRow: 9,
        layout: [
            '0 0 1 1 2 2 3 3 4 4 5 5 0 0',
            ' 0 1 1 2 2 3 3 4 4 5 5 0 0',
            '5 5 0 0 1 1 2 2 3 3 4 4 5 5',
            ' 5 0 0 1 1 2 2 3 3 4 4 5 5',
            '3 3 4 4 5 5 . . 0 0 1 1 2 2',
        ],
    },
    {
        name: 'Pruhy',
        secondsPerRow: 8,
        layout: [
            '0 1 2 3 4 5 0 1 2 3 4 5 0 1',
            ' 0 1 2 3 4 5 0 1 2 3 4 5 0',
            '1 2 3 4 5 0 1 2 3 4 5 0 1 2',
            ' 1 2 3 4 5 0 1 2 3 4 5 0 1',
            '2 3 4 5 0 1 2 3 4 5 0 1 2 3',
            ' 2 3 4 5 0 1 2 3 4 5 0 1 2',
            '. . 5 0 . . 3 4 . . 1 2 . .',
        ],
    },
    {
        name: 'Hrad',
        secondsPerRow: 8,
        layout: [
            '3 3 3 3 3 3 3 3 3 3 3 3 3 3',
            ' 3 . . 4 4 4 4 4 4 4 . . 3',
            '0 0 . 4 1 1 1 1 1 1 4 . 0 0',
            ' 0 0 . 4 1 2 2 2 1 4 . 0 0',
            '5 0 0 . 4 1 2 2 1 4 . 0 0 5',
            ' 5 . . . 4 1 1 1 4 . . . 5',
            '. . . . . 4 2 2 4 . . . . .',
        ],
    },
    {
        name: 'Finale',
        secondsPerRow: 7,
        layout: [
            '0 0 1 1 2 2 3 3 4 4 5 5 0 0',
            ' 5 0 1 1 2 3 3 4 4 5 5 0 1',
            '5 5 0 1 2 2 3 4 4 5 0 0 1 1',
            ' 4 5 0 1 2 3 3 4 5 0 0 1 2',
            '4 4 5 0 1 2 3 4 5 5 0 1 2 2',
            ' 3 4 5 0 1 2 3 4 5 0 1 2 3',
            '3 3 4 5 . . . . . . 1 2 3 3',
            ' 2 3 4 . . . . . . . 2 3 4',
        ],
    },
];
