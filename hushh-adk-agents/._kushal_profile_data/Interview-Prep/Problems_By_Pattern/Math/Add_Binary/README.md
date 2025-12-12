# Add Binary (LeetCode #67)

**Category**: String, Math, Bit Manipulation
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given two binary strings `a` and `b`, return their sum as a binary string.

## Example
**Input**: a = "11", b = "1"  
**Output**: "100"

**Input**: a = "1010", b = "1011"  
**Output**: "10101"

## Approach
- Process digits from right to left (least significant to most significant)
- Add corresponding digits along with carry
- For each position: sum = digitA + digitB + carry
- Result digit = sum % 2
- New carry = sum / 2
- Continue until both strings are processed and carry is 0
- Reverse the result to get the correct order
- Time complexity: `O(max(m, n))` where m and n are the lengths of a and b
- Space complexity: `O(max(m, n))` for the result string

## Key Insight
This is similar to adding decimal numbers, but with base 2:
- 0 + 0 = 0 (carry 0)
- 0 + 1 = 1 (carry 0)
- 1 + 1 = 0 (carry 1)
- 1 + 1 + 1 = 1 (carry 1)

We process from right to left, handling carry propagation, similar to the "Add Two Numbers" problem but with binary digits.

## Example Walkthrough
For `a = "11"`, `b = "1"`:
- Position 0 (rightmost): 1 + 1 = 2 → digit = 0, carry = 1
- Position 1: 1 + 0 + 1 = 2 → digit = 0, carry = 1
- Position 2: 0 + 0 + 1 = 1 → digit = 1, carry = 0
- Result (reversed): "100" ✓

## Edge Cases
- Different length strings: pad shorter string with 0s (handled by checking i >= 0 and j >= 0)
- Final carry: if carry is 1 after processing all digits, add it to the result

