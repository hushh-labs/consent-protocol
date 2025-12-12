# Reverse Integer (LeetCode #7)

**Category**: Math
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given a signed 32-bit integer `x`, return `x` with its digits reversed. If reversing `x` causes the value to go outside the signed 32-bit integer range `[-2^31, 2^31 - 1]`, then return `0`.

Assume we cannot store 64-bit integers.

## Example
**Input**: x = 123  
**Output**: 321

**Input**: x = -123  
**Output**: -321

**Input**: x = 120  
**Output**: 21

**Input**: x = 1534236469  
**Output**: 0 (overflow)

## Approach
- Extract digits from right to left using modulo and division
- Build the reversed number digit by digit
- Check for overflow before each multiplication to prevent integer overflow
- Return 0 if the reversed number would overflow the 32-bit integer range
- Time complexity: `O(log(x))` where x is the input number
- Space complexity: `O(1)`

## Key Insight
The challenge is handling overflow. We must check if `reversed * 10 + digit` would overflow **before** performing the operation. For 32-bit integers:
- Maximum: 2,147,483,647 (last digit is 7)
- Minimum: -2,147,483,648 (last digit is -8)

