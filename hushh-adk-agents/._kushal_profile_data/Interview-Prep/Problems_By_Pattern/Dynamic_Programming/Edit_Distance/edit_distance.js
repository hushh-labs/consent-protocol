/**
 * @param {string} word1
 * @param {string} word2
 * @return {number}
 *
 * APPROACH: 2D Dynamic Programming
 * - dp[i][j] = min operations to convert word1[0...i-1] to word2[0...j-1]
 * - If chars match: dp[i][j] = dp[i-1][j-1]
 * - Else: dp[i][j] = 1 + min(insert, delete, replace)
 * - Time: O(M × N)
 * - Space: O(M × N)
 */
var minDistance = function (word1, word2) {
  const m = word1.length;
  const n = word2.length;

  // Create DP table
  const dp = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  // Base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i; // Delete all characters from word1
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j; // Insert all characters to match word2
  }

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (word1[i - 1] === word2[j - 1]) {
        // Characters match - no operation needed
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Take minimum of three operations
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // Delete
            dp[i][j - 1], // Insert
            dp[i - 1][j - 1] // Replace
          );
      }
    }
  }

  return dp[m][n];
};

// Example usage:
// console.log(minDistance("horse", "ros")); // 3
// console.log(minDistance("intention", "execution")); // 5
