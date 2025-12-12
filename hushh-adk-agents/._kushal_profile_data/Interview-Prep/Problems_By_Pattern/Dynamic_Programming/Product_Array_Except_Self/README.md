# Product of Array Except Self (LeetCode #238)

**Category**: Array, Prefix Sum
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`.

The product of any prefix or suffix of `nums` is guaranteed to fit in a 32-bit integer.

You must write an algorithm that runs in `O(n)` time and without using the division operator.

## Example
**Input**: nums = [1,2,3,4]  
**Output**: [24,12,8,6]

**Input**: nums = [-1,1,0,-3,3]  
**Output**: [0,0,9,0,0]

## Approach
- Use two passes through the array
- **First pass (left to right)**: Calculate left products (product of all elements to the left of each index) and store in result array
- **Second pass (right to left)**: Calculate right products (product of all elements to the right of each index) and multiply with existing left products
- Time complexity: `O(n)` where n is the length of nums
- Space complexity: `O(1)` excluding the output array

## Key Insight
For each index `i`, the result is: `product of all elements to the left of i` × `product of all elements to the right of i`

Instead of using extra space for left and right arrays, we:
1. Store left products in the result array during first pass
2. Multiply by right products during second pass (calculating right products on the fly)

## Example Walkthrough
For `nums = [1,2,3,4]`:

**First pass (left products):**
- result[0] = 1 (no elements to the left)
- result[1] = 1 × 1 = 1
- result[2] = 1 × 2 = 2
- result[3] = 2 × 3 = 6
- result = [1, 1, 2, 6]

**Second pass (multiply by right products):**
- i=3: rightProduct=1, result[3] = 6 × 1 = 6, rightProduct = 1 × 4 = 4
- i=2: result[2] = 2 × 4 = 8, rightProduct = 4 × 3 = 12
- i=1: result[1] = 1 × 12 = 12, rightProduct = 12 × 2 = 24
- i=0: result[0] = 1 × 24 = 24
- Final result = [24, 12, 8, 6] ✓

## Constraints
- Cannot use division operator
- Must be O(n) time complexity
- Must be O(1) space complexity (excluding output array)
- Product guaranteed to fit in 32-bit integer

