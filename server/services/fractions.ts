// Exact arithmetic shared by plans and progress. Round only at the API boundary.
export type Fraction = { n: bigint; d: bigint };
const abs = (value: bigint) => value < 0n ? -value : value;
function gcd(a: bigint, b: bigint): bigint { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
export function fraction(n: bigint, d = 1n): Fraction {
  if (!d) throw new Error('Pembagi tidak boleh nol.');
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d); return { n: n / divisor, d: d / divisor };
}
export const add = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtract = (a: Fraction, b: Fraction) => add(a, { n: -b.n, d: b.d });
export const multiply = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
export function render(value: Fraction, places = 6): string {
  const scale = 10n ** BigInt(places), rounded = (abs(value.n) * scale * 2n + value.d) / (2n * value.d);
  return `${value.n < 0n && rounded ? '-' : ''}${rounded / scale}${places ? '.' + String(rounded % scale).padStart(places, '0') : ''}`;
}
