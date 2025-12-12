# Divide Two Integers (LeetCode #29)

**Category**: Math, Bit Manipulation
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given two integers `dividend` and `divisor`, divide two integers without using multiplication, division, and mod operator.

The integer division should truncate toward zero, which means losing its fractional part. For example, `8.345` would be truncated to `8`, and `-2.7335` would be truncated to `-2`.

Return the quotient after dividing `dividend` by `divisor`.

**Note**: Assume we are dealing with an environment that could only store integers within the 32-bit signed integer range: `[−2^31, 2^31 − 1]`. For this problem, if the quotient is strictly greater than `2^31 - 1`, then return `2^31 - 1`, and if the quotient is strictly less than `-2^31`, then return `-2^31`.

## Example
**Input**: dividend = 10, divisor = 3  
**Output**: 3  
**Explanation**: 10/3 = 3.33333.. which is truncated to 3.

**Input**: dividend = 7, divisor = -3  
**Output**: -2  
**Explanation**: 7/-3 = -2.33333.. which is truncated to -2.

**Input**: dividend = -2147483648, divisor = -1  
**Output**: 2147483647  
**Explanation**: Division would overflow, so return INT_MAX.

## Approach
- **Exponential Search / Bit Manipulation**: Instead of repeated subtraction (O(n)), we use exponential search
- Double the divisor and multiple until we find the largest power of 2 that fits
- Subtract and repeat until dividend < divisor
- Time complexity: `O(log(n))` where n is the dividend
- Space complexity: `O(1)`

## Key Insight
Instead of subtracting divisor one at a time:
- Find the largest `k` such that `divisor * 2^k <= dividend`
- Subtract `divisor * 2^k` and add `2^k` to quotient
- Repeat until dividend < divisor

This reduces the number of operations from O(n) to O(log n).

## Why the Simple Approach Fails
1. **Time Limit Exceeded**: Repeated subtraction is O(dividend/divisor). For large dividends and small divisors, this can loop billions of times.
2. **Quotient Overflow**: The quotient variable can overflow before the final bounds check.
3. **Inefficient**: LeetCode expects O(log n) solution, not O(n).

