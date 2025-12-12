# Counting Bits (LeetCode #338)

**Category**: Bit Manipulation, Dynamic Programming
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

Given an integer `n`, return an array `ans` of length `n + 1` such that for each `i` (`0 <= i <= n`), `ans[i]` is the **number of 1's** in the binary representation of `i`.

## Example

**Input**: n = 2
**Output**: [0,1,1]
**Explanation**:
0 --> 0
1 --> 1
2 --> 10

**Input**: n = 5
**Output**: [0,1,1,2,1,2]
**Explanation**:
0 --> 0
1 --> 1
2 --> 10
3 --> 11
4 --> 100
5 --> 101

## Approach

- **Dynamic Programming (Least Significant Bit)**
- We can compute the number of set bits for `i` using the result for `i >> 1` (which is `i / 2`).
- If `i` is even, `i` has the same number of set bits as `i >> 1` (shifting 0 out doesn't change count).
- If `i` is odd, `i` has one more set bit than `i >> 1` (the last bit is 1).
- Formula: `ans[i] = ans[i >> 1] + (i & 1)`

## Key Insight

- `i >> 1` drops the last bit.
- `i & 1` gives the last bit (0 or 1).
- We can build the array from `0` to `n` in O(n) time.

## Complexity

- **Time Complexity**: O(n) - Single pass through numbers 0 to n.
- **Space Complexity**: O(1) - Excluding the return array.

## Common Mistakes

1. **Recomputing for every number**: O(n log n) approach (counting bits for each number individually) is slower.
2. **Using string conversion**: `i.toString(2)` is expensive.
3. **Not handling 0**: Base case `ans[0] = 0`.

## Bit Manipulation Pattern

This problem uses:

- **Right Shift (`>>`)**: To look at the number without the last bit.
- **Bitwise AND (`&`)**: To check the last bit.
- **DP Array**: To reuse previously computed results.
