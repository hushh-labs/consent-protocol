// Counting Bits - TypeScript implementation
// Time Complexity: O(n)
// Space Complexity: O(1) (excluding return array)

/**
 * @param {number} n
 * @return {number[]}
 */
export function countBits(n: number): number[] {
  const ans: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    // ans[i] = ans[i / 2] + (i % 2)
    // i >> 1 is equivalent to Math.floor(i / 2)
    // i & 1 is equivalent to i % 2
    ans[i] = ans[i >> 1] + (i & 1);
  }

  return ans;
}
