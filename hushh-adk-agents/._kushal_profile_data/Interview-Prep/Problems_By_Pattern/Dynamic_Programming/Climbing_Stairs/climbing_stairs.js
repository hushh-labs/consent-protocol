/**
 * @param {number} n
 * @return {number}
 *
 * APPROACH: Dynamic Programming (Fibonacci Pattern)
 * - To reach step n, you came from step n-1 or n-2
 * - ways(n) = ways(n-1) + ways(n-2)
 * - Use two variables for O(1) space optimization
 * - Time: O(N)
 * - Space: O(1)
 */
var climbStairs = function (n) {
  // Base cases
  if (n <= 2) return n;

  // Initialize for n=1 and n=2
  let prev2 = 1; // ways to reach step 1
  let prev1 = 2; // ways to reach step 2

  // Build up from step 3 to n
  for (let i = 3; i <= n; i++) {
    let current = prev1 + prev2; // Fibonacci: F(i) = F(i-1) + F(i-2)
    prev2 = prev1;
    prev1 = current;
  }

  return prev1;
};

// Example usage:
// console.log(climbStairs(2)); // 2
// console.log(climbStairs(3)); // 3
// console.log(climbStairs(5)); // 8
