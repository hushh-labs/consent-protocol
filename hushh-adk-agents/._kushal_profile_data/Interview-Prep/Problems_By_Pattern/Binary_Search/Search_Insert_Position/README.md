# Search Insert Position (LeetCode #35)

**Category**: Binary Search, Arrays
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be if it were inserted in order.

You must write an algorithm with `O(log n)` runtime complexity.

## Example
**Input**: nums = [1,3,5,6], target = 5  
**Output**: 2

**Input**: nums = [1,3,5,6], target = 2  
**Output**: 1

**Input**: nums = [1,3,5,6], target = 7  
**Output**: 4

## Approach
- Use binary search to find the target or determine insertion position
- If target is found, return its index
- If target is not found, `left` pointer will be at the correct insertion position
- Time complexity: `O(log(n))`
- Space complexity: `O(1)`

## Key Insight
When the binary search loop ends (`left > right`), the `left` pointer always points to the position where the target should be inserted. This is because:
- If `target < nums[mid]`, we move `right = mid - 1`, and `left` stays at the position where target should be
- If `target > nums[mid]`, we move `left = mid + 1`, which is the next position where target could be

## Example Walkthrough
For `nums = [1,3,5,6]`, `target = 2`:
- Initial: left=0, right=3, mid=1, nums[1]=3
- Since 2 < 3: right=0, left=0
- Now left=0, right=0, mid=0, nums[0]=1
- Since 2 > 1: left=1, right=0
- Loop ends, return left=1 ✓

