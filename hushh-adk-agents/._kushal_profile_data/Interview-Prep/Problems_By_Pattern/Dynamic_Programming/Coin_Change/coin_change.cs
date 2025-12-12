// Coin Change - C# implementation
// Time Complexity: O(amount * coins.Length)
// Space Complexity: O(amount)

public class Solution
{
    public int CoinChange(int[] coins, int amount)
    {
        // dp[i] represents the minimum number of coins needed to make amount i
        int[] dp = new int[amount + 1];
        Array.Fill(dp, int.MaxValue);
        dp[0] = 0; // 0 coins needed to make amount 0

        // For each amount from 1 to target amount
        for (int i = 1; i <= amount; i++)
        {
            // Try each coin denomination
            foreach (int coin in coins)
            {
                // If coin value is less than or equal to current amount
                if (coin <= i && dp[i - coin] != int.MaxValue)
                {
                    // Update dp[i] with minimum coins needed
                    dp[i] = Math.Min(dp[i], dp[i - coin] + 1);
                }
            }
        }

        // If dp[amount] is still int.MaxValue, it means it's impossible
        return dp[amount] == int.MaxValue ? -1 : dp[amount];
    }
}

