// Coin Change - JavaScript implementation
// Time Complexity: O(amount * coins.length)
// Space Complexity: O(amount)

function coinChange(coins, amount) {
  // dp[i] represents the minimum number of coins needed to make amount i
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0; // 0 coins needed to make amount 0

  // For each amount from 1 to target amount
  for (let i = 1; i <= amount; i++) {
    // Try each coin denomination
    for (const coin of coins) {
      // If coin value is less than or equal to current amount
      if (coin <= i) {
        // Update dp[i] with minimum coins needed
        dp[i] = Math.min(dp[i], dp[i - coin] + 1);
      }
    }
  }

  // If dp[amount] is still Infinity, it means it's impossible
  return dp[amount] === Infinity ? -1 : dp[amount];
}

module.exports = { coinChange };
