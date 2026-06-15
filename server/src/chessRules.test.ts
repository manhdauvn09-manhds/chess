import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { claimableDraw, forcedEndState, hasMatingMaterial, timeoutResult } from './chessRules.js';

test('forcedEndState: phát hiện chiếu hết (fool mate) -> Đen thắng', () => {
  const c = new Chess();
  ['f3', 'e5', 'g4', 'Qh4#'].forEach((m) => c.move(m));
  const s = forcedEndState(c);
  assert.equal(s.over, true);
  assert.equal(s.result, 'black');
  assert.equal(s.reason, 'checkmate');
});

test('forcedEndState: scholar mate -> Trắng thắng', () => {
  const c = new Chess();
  ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'].forEach((m) => c.move(m));
  const s = forcedEndState(c);
  assert.equal(s.result, 'white');
  assert.equal(s.reason, 'checkmate');
});

test('forcedEndState: stalemate -> hoà', () => {
  // Thế bí nổi tiếng: Đen tới lượt nhưng không còn nước hợp lệ.
  const c = new Chess('5k2/5P2/5K2/8/8/8/8/8 b - - 0 1');
  const s = forcedEndState(c);
  assert.equal(s.over, true);
  assert.equal(s.result, 'draw');
  assert.equal(s.reason, 'stalemate');
});

test('forcedEndState: K vs K -> hoà thiếu quân', () => {
  const c = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  const s = forcedEndState(c);
  assert.equal(s.reason, 'insufficient');
});

test('forcedEndState: thế ban đầu chưa kết thúc', () => {
  assert.equal(forcedEndState(new Chess()).over, false);
});

test('hasMatingMaterial: chỉ còn vua -> không đủ', () => {
  const c = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  assert.equal(hasMatingMaterial(c, 'white'), false);
  assert.equal(hasMatingMaterial(c, 'black'), false);
});

test('hasMatingMaterial: vua + 1 mã -> không đủ', () => {
  const c = new Chess('4k3/8/8/8/8/8/8/3NK3 w - - 0 1');
  assert.equal(hasMatingMaterial(c, 'white'), false);
});

test('hasMatingMaterial: vua + 2 mã -> đủ (về lý thuyết)', () => {
  const c = new Chess('4k3/8/8/8/8/8/8/2N1KN2 w - - 0 1');
  assert.equal(hasMatingMaterial(c, 'white'), true);
});

test('hasMatingMaterial: có tốt/xe/hậu -> đủ', () => {
  assert.equal(hasMatingMaterial(new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'), 'white'), true);
  assert.equal(hasMatingMaterial(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'), 'white'), true);
});

test('timeoutResult: bên thắng đủ quân -> thắng', () => {
  const c = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'); // Trắng có xe
  assert.equal(timeoutResult(c, 'black'), 'white'); // Đen hết giờ
});

test('timeoutResult: bên thắng chỉ còn vua -> HOÀ', () => {
  const c = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  assert.equal(timeoutResult(c, 'black'), 'draw');
});

test('claimableDraw: lặp 3 lần -> threefold', () => {
  const c = new Chess();
  // Đẩy mã qua lại 3 lần để lặp thế.
  const seq = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
  seq.forEach((m) => c.move(m));
  assert.equal(claimableDraw(c), 'threefold');
});

test('claimableDraw: thế thường -> null', () => {
  assert.equal(claimableDraw(new Chess()), null);
});
