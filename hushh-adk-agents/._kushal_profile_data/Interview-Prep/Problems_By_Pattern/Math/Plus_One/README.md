# Plus One (LeetCode #66)

**Category**: Array, Math
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
You are given a large integer represented as an integer array `digits`, where each `digits[i]` is the `i`th digit of the integer. The digits are ordered from most significant to least significant in left-to-right order. The large integer does not contain any leading zeros.

Increment the large integer by one and return the resulting array of digits.

## Example
**Input**: digits = [1,2,3]  
**Output**: [1,2,4]  
**Explanation**: The array represents the integer 123. Incrementing by one gives 123 + 1 = 124.

**Input**: digits = [4,3,2,1]  
**Output**: [4,3,2,2]  
**Explanation**: The array represents the integer 4321. Incrementing by one gives 4321 + 1 = 4322.

**Input**: digits = [9]  
**Output**: [1,0]  
**Explanation**: The array represents the integer 9. Incrementing by one gives 9 + 1 = 10.

## Approach
- Start from the rightmost (least significant) digit
- If digit < 9, increment it and return (no carry needed)
- If digit = 9, set it to 0 and continue to the next digit (carry over)
- If all digits were 9, create a new array with 1 at the beginning and rest zeros
- Time complexity: `O(n)` where n is the length of digits array
- Space complexity: `O(1)` excluding the output array

## Key Insight
The problem is essentially adding 1 with carry propagation:
- Most cases: just increment the last digit
- When last digit is 9: set to 0 and carry to the left
- When all digits are 9: result is [1, 0, 0, ..., 0] (one more digit)

## Example Walkthrough
For `digits = [9, 9, 9]`:
- i=2: digits[2]=9 → set to 0, continue
- i=1: digits[1]=9 → set to 0, continue
- i=0: digits[0]=9 → set to 0, continue
- Loop ends, return [1, 0, 0, 0] ✓

