import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookMove } from './openingBook';

test('bookMove: thế ban đầu trả về một nước khai cuộc hợp lệ', () => {
  const m = bookMove([]);
  assert.ok(m, 'phải có nước sách');
  assert.ok(['e2e4', 'd2d4', 'c2c4', 'g1f3'].includes(m!), `got ${m}`);
});

test('bookMove: nối tiếp đúng biến (1.e4 e5 2.Nf3 -> Nc6/Nf6)', () => {
  // Sách có cả Nc6 (Ý/Tây Ban Nha) lẫn Nf6 (Petrov) -> chấp nhận cả hai.
  const valid = new Set(['b8c6', 'g8f6']);
  for (let i = 0; i < 30; i++) {
    const m = bookMove(['e2e4', 'e7e5', 'g1f3']);
    assert.ok(m && valid.has(m), `got ${m}`);
  }
});

test('bookMove: tiền tố không khớp biến nào -> null', () => {
  assert.equal(bookMove(['a2a3', 'a7a6']), null);
});

test('bookMove: hết sách (đi quá độ dài biến) -> null', () => {
  // chuỗi dài hơn mọi biến trong sách
  const long = Array(40).fill('e2e4');
  assert.equal(bookMove(long as string[]), null);
});

test('bookMove: ngẫu nhiên vẫn nằm trong tập ứng viên hợp lệ', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const m = bookMove([]);
    if (m) seen.add(m);
  }
  for (const m of seen) assert.ok(['e2e4', 'd2d4', 'c2c4', 'g1f3'].includes(m));
});
