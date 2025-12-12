// Reverse Integer - TypeScript implementation
// Time Complexity: O(log(x)) where x is the input number
// Space Complexity: O(1)

const highestPlaceValue = (n: number): number => {
  if (n === 0) return 0;
  const num = Math.abs(n);
  const digits = Math.floor(Math.log10(num)) + 1;
  return Math.pow(10, digits - 1);
};

export function reverse(x: number): number {
  if (x === 0) return 0;

  let roundedMax: number = highestPlaceValue(x);
  let result: number = 0;
  let temp = Math.abs(x);
  let isPositive: number = x > 0 ? 1 : -1;
  let count = 0;
  const INT_MAX = Math.pow(2, 31) - 1;
  const INT_MIN = -Math.pow(2, 31);
  const ABS_INT_MIN = Math.pow(2, 31); // 2147483648

  while (temp > 0) {
    const contribution = (temp % 10) * (roundedMax / Math.pow(10, count++));

    // Check for overflow before adding
    if (isPositive === 1) {
      // For positive: result must not exceed INT_MAX
      if (result > INT_MAX - contribution) {
        return 0;
      }
    } else {
      // For negative: when negated, result must not exceed abs(INT_MIN) = 2147483648
      if (result > ABS_INT_MIN - contribution) {
        return 0;
      }
    }

    result = result + contribution;
    temp = Math.floor(temp / 10);
  }

  return isPositive * result;
}
