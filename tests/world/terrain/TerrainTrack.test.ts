import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainStyle, styleIdAt, styleRowAt } from '../../../src/world/terrain/TerrainStyle.ts';
import { TerrainTrack } from '../../../src/world/terrain/TerrainTrack.ts';

/** 2 columns; every row's two ids are 10 * row + col so a lookup shows which row of which style it came from. */
function style(name: string, rows: number, base: number, extra: object = {}) {
    const ids: number[] = [];
    for (let r = 0; r < rows; r++) ids.push(base + r * 10, base + r * 10 + 1);
    return createTerrainStyle({ name, cols: 2, rows, ids, ...extra });
}

test('rows play in order, then wrap from the loop end back to the loop start', () => {
    const s = style('s', 6, 0, { introRows: 2, loopStartRow: 3, loopEndRow: 5 });
    const played = Array.from({ length: 10 }, (_, i) => styleRowAt(s, i));
    assert.deepEqual(played, [0, 1, 2, 3, 4, 3, 4, 3, 4, 3]);
});

test('with defaults a style loops over all its rows', () => {
    const s = style('s', 3, 0);
    assert.deepEqual(Array.from({ length: 7 }, (_, i) => styleRowAt(s, i)), [0, 1, 2, 0, 1, 2, 0]);
});

test('columns wrap in both directions', () => {
    const s = style('s', 2, 0);
    assert.equal(styleIdAt(s, 1, 0), 10);
    assert.equal(styleIdAt(s, 1, 2), 10);
    assert.equal(styleIdAt(s, 1, -1), 11);
    assert.equal(styleIdAt(s, 1, 5), 11);
});

test('invalid styles are rejected', () => {
    const base = { name: 'bad', cols: 2, rows: 4, ids: new Array(8).fill(0) };
    assert.throws(() => createTerrainStyle({ ...base, ids: [0] }), /cols \* rows/);
    assert.throws(() => createTerrainStyle({ ...base, introRows: 3, loopStartRow: 2 }), /introRows/);
    assert.throws(() => createTerrainStyle({ ...base, loopStartRow: 3, loopEndRow: 3 }), /loopEndRow/);
    assert.throws(() => createTerrainStyle({ ...base, loopEndRow: 5 }), /rows/);
    assert.throws(() => createTerrainStyle({ ...base, ids: new Array(8).fill(70000) }), /chunk id/);
});

test('the track serves the first style from row 0 and nothing before it', () => {
    const track = new TerrainTrack(style('a', 3, 100));
    assert.equal(track.idAt(-1, 0), -1);
    assert.equal(track.styleAt(-1), null);
    assert.equal(track.idAt(0, 1), 101);
    assert.equal(track.idAt(4, 0), 110);
});

test('a style queued for the next row takes over after the rows already requested', () => {
    const track = new TerrainTrack(style('a', 3, 100));
    track.markRequested(5);
    const start = track.queueStyle(style('b', 4, 200, { introRows: 1, loopStartRow: 1 }));
    assert.equal(start, 6);
    assert.equal(track.idAt(5, 0), 120); // row 5 of the old style (played 5 -> 5 % 3 = 2)
    assert.equal(track.idAt(6, 0), 200); // new style's intro row
    assert.equal(track.idAt(7, 0), 210);
    assert.equal(track.idAt(10, 0), 210 + 0); // 4 played rows -> loop of rows 1..3 -> row 1
    assert.equal(track.styleAt(9)?.name, 'b');
});

test('rows already on screen are unchanged by a transition', () => {
    const track = new TerrainTrack(style('a', 3, 100));
    const before = Array.from({ length: 6 }, (_, r) => track.idAt(r, 0));
    track.markRequested(5);
    track.queueStyle(style('b', 2, 200));
    assert.deepEqual(Array.from({ length: 6 }, (_, r) => track.idAt(r, 0)), before);
});

test('a style queued for the loop end waits for the current pass to finish', () => {
    const track = new TerrainTrack(style('a', 4, 100, { introRows: 1, loopStartRow: 1, loopEndRow: 3 }));
    track.markRequested(0);
    // rows 0..2 play the intro and first pass; the pass ends after row 2, then every 2 rows
    assert.equal(track.queueStyle(style('b', 2, 200), 'loopEnd'), 3);

    const second = new TerrainTrack(style('a', 4, 100, { introRows: 1, loopStartRow: 1, loopEndRow: 3 }));
    second.markRequested(3);
    assert.equal(second.queueStyle(style('c', 2, 300), 'loopEnd'), 5);
});

test('styles queued back to back follow each other', () => {
    const track = new TerrainTrack(style('a', 3, 100));
    const first = track.queueStyle(style('b', 2, 200));
    const second = track.queueStyle(style('c', 2, 300));
    assert.ok(second > first);
    assert.equal(track.styleAt(first)?.name, 'b');
    assert.equal(track.styleAt(second)?.name, 'c');
});
