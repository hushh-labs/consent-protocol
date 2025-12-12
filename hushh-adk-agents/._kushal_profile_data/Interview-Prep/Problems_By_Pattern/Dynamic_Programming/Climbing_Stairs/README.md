# Climbing Stairs (LeetCode #70)

**Category**: Dynamic Programming, Math
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 50%

## Problem Statement

You are climbing a staircase. It takes `n` steps to reach the top.

Each time you can either climb **1 or 2 steps**. In how many distinct ways can you climb to the top?

## Example

**Input**: n = 2
**Output**: 2
**Explanation**: There are two ways to climb to the top.

1. 1 step + 1 step
2. 2 steps

**Input**: n = 3
**Output**: 3
**Explanation**: There are three ways to climb to the top.

1. 1 step + 1 step + 1 step
2. 1 step + 2 steps
3. 2 steps + 1 step

## Approach: Dynamic Programming (Fibonacci Pattern)

**Key Insight**: To reach step `n`, you must have come from either step `n-1` (1 step) or step `n-2` (2 steps).

Therefore: `ways(n) = ways(n-1) + ways(n-2)`

This is exactly the **Fibonacci sequence**!

### Algorithm

1. Base cases:
   - `n = 1`: 1 way
   - `n = 2`: 2 ways
2. For `n >= 3`:
   - `ways[i] = ways[i-1] + ways[i-2]`
3. Use two variables instead of an array for O(1) space

## Complexity

- **Time Complexity**: O(N) - compute each step once
- **Space Complexity**: O(1) - only two variables (optimized from O(N) array)

## Common Mistakes

1. **Using recursion without memoization** - O(2^N) time, too slow
2. **Not recognizing Fibonacci pattern** - Overcomplicating the solution
3. **Using array when two variables suffice** - Wasting space

## Pattern Recognition

Any problem asking "how many ways to reach position N with steps of size 1 or 2" is a Fibonacci variant.
