import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findKing } from './boardUtils';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('findKing: thế ban đầu -> vua Trắng e1, vua Đen e8', () => {
  assert.equal(findKing(START, 'white'), 'e1');
  assert.equal(findKing(START, 'black'), 'e8');
});

test('findKing: vua đã di chuyển', () => {
  const fen = '4k3/8/8/8/8/8/8/6K1 w - - 0 1';
  assert.equal(findKing(fen, 'white'), 'g1');
  assert.equal(findKing(fen, 'black'), 'e8');
});

test('findKing: vua ở góc', () => {
  const fen = '7k/8/8/8/8/8/8/K7 w - - 0 1';
  assert.equal(findKing(fen, 'white'), 'a1');
  assert.equal(findKing(fen, 'black'), 'h8');
});
