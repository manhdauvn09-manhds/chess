// Hệ thống Elo chuẩn (FIDE-like) — tính hoàn toàn ở server để chống gian lận.
//
// Công thức:
//   Expected(A) = 1 / (1 + 10^((Rb - Ra) / 400))
//   R'a = Ra + K * (Sa - Ea)
// Trong đó Sa = 1 (thắng), 0.5 (hòa), 0 (thua).
//
// K-factor động (theo quy ước FIDE):
//   - K = 40 nếu người chơi đấu < 30 trận (người mới)
//   - K = 20 nếu rating < 2400
//   - K = 10 nếu rating >= 2400 (đã từng đạt 2400)

export type GameResult = 'white' | 'black' | 'draw';

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function kFactor(rating: number, gamesPlayed: number, peakRating: number): number {
  if (gamesPlayed < 30) return 40;
  if (peakRating >= 2400) return 10;
  return 20;
}

export interface PlayerRating {
  rating: number;
  gamesPlayed: number;
  peakRating: number;
}

export interface EloUpdate {
  whiteNew: number;
  blackNew: number;
  whiteDelta: number;
  blackDelta: number;
}

/**
 * Tính rating mới cho 2 người chơi sau 1 ván.
 * Làm tròn về số nguyên, không cho tụt dưới 100.
 */
export function computeElo(
  white: PlayerRating,
  black: PlayerRating,
  result: GameResult
): EloUpdate {
  const eWhite = expectedScore(white.rating, black.rating);
  const eBlack = 1 - eWhite;

  let sWhite: number;
  if (result === 'white') sWhite = 1;
  else if (result === 'black') sWhite = 0;
  else sWhite = 0.5;
  const sBlack = 1 - sWhite;

  const kWhite = kFactor(white.rating, white.gamesPlayed, white.peakRating);
  const kBlack = kFactor(black.rating, black.gamesPlayed, black.peakRating);

  const whiteDelta = Math.round(kWhite * (sWhite - eWhite));
  const blackDelta = Math.round(kBlack * (sBlack - eBlack));

  const whiteNew = Math.max(100, white.rating + whiteDelta);
  const blackNew = Math.max(100, black.rating + blackDelta);

  return { whiteNew, blackNew, whiteDelta, blackDelta };
}

export const DEFAULT_RATING = 1200;
