# Best Time to Buy and Sell Stock (LeetCode #121)

**Category**: Array, Dynamic Programming, Greedy
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

You are given an array `prices` where `prices[i]` is the price of a given stock on the `i-th` day.

You want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.

Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.

## Example

**Input**: prices = [7,1,5,3,6,4]
**Output**: 5
**Explanation**: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5. Note that buying on day 2 and selling on day 1 is not allowed because you must buy before you sell.

**Input**: prices = [7,6,4,3,1]
**Output**: 0
**Explanation**: In this case, no transactions are done and the max profit = 0.

## Approach: One Pass (Greedy)

The brute force approach is to check every pair of days ($O(N^2)$), which is too slow.
We can solve this in a single pass ($O(N)$).

1.  Keep track of the **minimum price** seen so far (`minPrice`). Initialize it to a very large number.
2.  Keep track of the **maximum profit** seen so far (`maxProfit`). Initialize it to 0.
3.  Iterate through the prices:
    - If the current price is **lower** than `minPrice`, update `minPrice`. (We found a better day to buy!)
    - Else, if the profit from selling today (`currentPrice - minPrice`) is **greater** than `maxProfit`, update `maxProfit`.

## Complexity

- **Time Complexity**: O(N). We traverse the array once.
- **Space Complexity**: O(1). We only use two variables.

## Key Insight

- You only care about the **lowest price in the past**. You don't need to know exactly _which_ day it was, just what the price was.
- This is technically a simple form of Dynamic Programming or Greedy approach.
