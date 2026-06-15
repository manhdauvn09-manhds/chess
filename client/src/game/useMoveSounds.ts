import { useEffect, useRef } from 'react';
import { playForSan, playGameEnd, playGameStart } from '../sound';

// Phát âm cho nước đi mới nhất mỗi khi lịch sử dài thêm + âm kết thúc ván.
// Đồng nhất cho offline / bot / online vì đều dựa trên ký hiệu SAN.
export function useMoveSounds(history: string[], over = false) {
  const prevLen = useRef(history.length);
  const endedRef = useRef(false);

  useEffect(() => {
    playGameStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (history.length > prevLen.current) {
      playForSan(history[history.length - 1]);
    }
    prevLen.current = history.length;
  }, [history]);

  useEffect(() => {
    if (over && !endedRef.current) {
      endedRef.current = true;
      const last = history[history.length - 1] || '';
      if (!last.includes('#')) playGameEnd(); // chiếu hết đã có âm riêng
    }
  }, [over, history]);
}
