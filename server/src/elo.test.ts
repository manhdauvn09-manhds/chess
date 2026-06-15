import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeElo, expectedScore, kFactor, DEFAULT_RATING } from './elo.js';

test('expectedScore: hai người bằng rating -> 0.5', () => {
  assert.equal(expectedScore(1500, 1500), 0.5);
});

test('expectedScore: chênh 400 điểm -> ~0.909 cho bên cao', () => {
  const e = expectedScore(1900, 1500);
  assert.ok(Math.abs(e - 0.909) < 0.001, `got ${e}`);
});

test('expectedScore: đối xứng (tổng = 1)', () => {
  const a = expectedScore(1632, 1411);
  const b = expectedScore(1411, 1632);
  assert.ok(Math.abs(a + b - 1) < 1e-9);
});

test('kFactor: người mới (<30 trận) = 40', () => {
  assert.equal(kFactor(1500, 10, 1500), 40);
});
test('kFactor: rating thường = 20', () => {
  assert.equal(kFactor(1500, 100, 1700), 20);
});
test('kFactor: cao thủ peak>=2400 = 10', () => {
  assert.equal(kFactor(2300, 100, 2450), 10);
});

test('computeElo: cùng rating, Trắng thắng -> +/- K/2 (=10 với K20)', () => {
  const u = { rating: 1500, gamesPlayed: 100, peakRating: 1500 };
  const r = computeElo(u, { ...u }, 'white');
  assert.equal(r.whiteDelta, 10);
  assert.equal(r.blackDelta, -10);
  assert.equal(r.whiteNew, 1510);
  assert.equal(r.blackNew, 1490);
});

test('computeElo: hoà giữa hai người bằng điểm -> không đổi', () => {
  const u = { rating: 1500, gamesPlayed: 100, peakRating: 1500 };
  const r = computeElo(u, { ...u }, 'draw');
  assert.equal(r.whiteDelta, 0);
  assert.equal(r.blackDelta, 0);
});

test('computeElo: cửa dưới thắng được nhiều điểm hơn', () => {
  const weak = { rating: 1400, gamesPlayed: 100, peakRating: 1400 };
  const strong = { rating: 1800, gamesPlayed: 100, peakRating: 1800 };
  const r = computeElo(weak, strong, 'white'); // weak (Trắng) thắng
  assert.ok(r.whiteDelta >= 17, `kèo dưới thắng phải +nhiều, got ${r.whiteDelta}`);
  assert.equal(r.whiteDelta, -r.blackDelta);
});

test('computeElo: tổng điểm zero-sum khi cùng K', () => {
  const a = { rating: 1550, gamesPlayed: 100, peakRating: 1550 };
  const b = { rating: 1490, gamesPlayed: 100, peakRating: 1490 };
  const r = computeElo(a, b, 'black');
  assert.equal(r.whiteDelta + r.blackDelta, 0);
});

test('computeElo: rating không tụt dưới 100', () => {
  const low = { rating: 100, gamesPlayed: 100, peakRating: 100 };
  const high = { rating: 2000, gamesPlayed: 100, peakRating: 2000 };
  const r = computeElo(low, high, 'black'); // low (Trắng) thua
  assert.ok(r.whiteNew >= 100);
});

test('DEFAULT_RATING = 1200', () => {
  assert.equal(DEFAULT_RATING, 1200);
});
