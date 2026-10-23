import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScore } from '../../src/systems/text/formatScore.ts';

test('the score is zero-padded and grows from the right', () => {
    assert.equal(formatScore(0, 9), '000000000');
    assert.equal(formatScore(100, 9), '000000100');
    assert.equal(formatScore(250, 9), '000000250');
    assert.equal(formatScore(1000, 9), '000001000');
});

test('the score is capped at all nines', () => {
    assert.equal(formatScore(999_999_999, 9), '999999999');
    assert.equal(formatScore(5_000_000_000, 9), '999999999');
});

test('a negative or fractional score is shown as a whole non-negative number', () => {
    assert.equal(formatScore(-5, 9), '000000000');
    assert.equal(formatScore(49.9, 9), '000000049');
});
