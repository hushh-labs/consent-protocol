# Coin Change (LeetCode #322)

**Category**: Dynamic Programming, Array
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.

Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.

You may assume that you have an infinite number of each kind of coin.

## Example
**Input**: coins = [1,2,5], amount = 11  
**Output**: 3  
**Explanation**: 11 = 5 + 5 + 1

**Input**: coins = [2], amount = 3  
**Output**: -1  
**Explanation**: The amount 3 cannot be made up with coins of value 2.

**Input**: coins = [1], amount = 0  
**Output**: 0

## Approach
- Use dynamic programming with bottom-up approach
- `dp[i]` represents the minimum number of coins needed to make amount `i`
- Initialize `dp[0] = 0` (0 coins needed for amount 0)
- For each amount from 1 to target:
  - Try each coin denomination
  - If coin value <= current amount, update `dp[i] = min(dp[i], dp[i - coin] + 1)`
- Return `dp[amount]` if it's not Infinity/MaxValue, else -1
- Time complexity: `O(amount * coins.length)`
- Space complexity: `O(amount)`

## Key Insight
This is a classic unbounded knapsack problem:
- For each amount, we try all possible coins
- If we can make amount `i - coin`, we can make amount `i` by adding one more coin
- We want the minimum number of coins, so we take the minimum across all possibilities

## Example Walkthrough
For `coins = [1,2,5]`, `amount = 11`:

**DP Table:**
- dp[0] = 0
- dp[1] = min(dp[0] + 1) = 1
- dp[2] = min(dp[1] + 1, dp[0] + 1) = min(2, 1) = 1
- dp[3] = min(dp[2] + 1, dp[1] + 1) = min(2, 2) = 2
- dp[4] = min(dp[3] + 1, dp[2] + 1) = min(3, 2) = 2
- dp[5] = min(dp[4] + 1, dp[3] + 1, dp[0] + 1) = min(3, 3, 1) = 1
- ...
- dp[11] = min(dp[10] + 1, dp[9] + 1, dp[6] + 1) = 3

Result: 3 coins (5 + 5 + 1) ✓

## Dynamic Programming Formula
```
dp[i] = min(dp[i], dp[i - coin] + 1) for all coins where coin <= i
```

