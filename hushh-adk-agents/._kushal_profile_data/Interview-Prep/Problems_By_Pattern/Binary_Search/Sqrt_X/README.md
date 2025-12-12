# Sqrt(x) (LeetCode #69)

**Category**: Binary Search, Math
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given a non-negative integer `x`, return the square root of `x` rounded down to the nearest integer. The returned integer should be non-negative as well.

You must not use any built-in exponent function or operator.

## Example
**Input**: x = 4  
**Output**: 2

**Input**: x = 8  
**Output**: 2  
**Explanation**: The square root of 8 is 2.82842..., and since we round it down to the nearest integer, 2 is returned.

**Input**: x = 0  
**Output**: 0

## Approach
- Use binary search to find the square root
- Search space: from 1 to x/2 (since sqrt(x) <= x/2 for x >= 2)
- For each mid value, check if mid * mid equals, is less than, or greater than x
- If mid * mid == x, return mid
- If mid * mid < x, search right half
- If mid * mid > x, search left half
- When loop ends, return `right` (the floor value)
- Time complexity: `O(log(x))`
- Space complexity: `O(1)`

## Key Insight
We're looking for the largest integer `k` such that `k * k <= x`. Binary search efficiently finds this value:
- If `mid * mid <= x`, we can try larger values (move left = mid + 1)
- If `mid * mid > x`, we need smaller values (move right = mid - 1)
- When the loop ends, `right` is the largest integer whose square is <= x

## Example Walkthrough
For `x = 8`:
- Initial: left=1, right=4
- mid=2, square=4 < 8 → left=3, right=4
- mid=3, square=9 > 8 → left=3, right=2
- Loop ends, return right=2 ✓

## Edge Cases
- x = 0: return 0
- x = 1: return 1
- Large x: Use long in C# to prevent overflow when calculating mid * mid

