function divide(dividend: number, divisor: number): number {
  if (dividend === 0) return 0;
  let temp = Math.abs(dividend);
  let temp2 = Math.abs(divisor);
  let isPositiveDivisor: number = divisor > 0 ? 1 : -1;
  let flag: number =
    dividend > 0 ? 1 * isPositiveDivisor : -1 * isPositiveDivisor;

  let intMin = -Math.pow(2, 31);
  let intMax = Math.pow(2, 31) - 1;

  let quotient = 0;
  while (temp >= temp2) {
    temp = temp - temp2;
    quotient++;
  }
  if (quotient * flag < intMin) {
    return intMin;
  }
  if (quotient * flag > intMax) {
    return intMax;
  } else return quotient * flag;
}
