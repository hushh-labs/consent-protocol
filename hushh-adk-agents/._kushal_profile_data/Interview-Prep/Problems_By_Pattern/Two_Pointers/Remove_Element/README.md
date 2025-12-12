# Remove Element (LeetCode #27)

**Category**: Array, Two Pointers
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given an integer array `nums` and an integer `val`, remove all occurrences of `val` in `nums` in-place. The order of the elements may be changed. Then return the number of elements in `nums` which are not equal to `val`.

Consider the number of elements in `nums` which are not equal to `val` be `k`, to get accepted, you need to do the following things:
- Change the array `nums` such that the first `k` elements of `nums` contain the elements which are not equal to `val`. The elements beyond the first `k` elements are not important.
- Return `k`.

## Example
**Input**: nums = [3,2,2,3], val = 3  
**Output**: 2, nums = [2,2,_,_]  
**Explanation**: Your function should return k = 2, with the first two elements of nums being 2. It does not matter what you leave beyond the returned k.

**Input**: nums = [0,1,2,2,3,0,4,2], val = 2  
**Output**: 5, nums = [0,1,4,0,3,_,_,_]  
**Explanation**: Your function should return k = 5, with the first five elements of nums being 0, 1, 3, 0, and 4. Note that the order can be changed.

## Approach
- Use two pointers: one to read through the array, one to write valid elements
- Iterate through the array with the read pointer
- If the current element is not equal to `val`, copy it to the write position and increment write pointer
- If the current element equals `val`, skip it (don't copy, don't increment write pointer)
- Return the write pointer index (which is the count of valid elements)
- Time complexity: `O(n)` where n is the length of nums array
- Space complexity: `O(1)`

## Key Insight
This is a classic two-pointer problem:
- **Read pointer (i)**: Scans through the entire array
- **Write pointer (writeIndex)**: Tracks where to place the next valid element
- We only write elements that are not equal to `val`
- The first `k` elements will contain all valid elements

## Example Walkthrough
For `nums = [3,2,2,3]`, `val = 3`:
- i=0: nums[0]=3 (equals val) → skip, writeIndex=0
- i=1: nums[1]=2 (not val) → nums[0]=2, writeIndex=1
- i=2: nums[2]=2 (not val) → nums[1]=2, writeIndex=2
- i=3: nums[3]=3 (equals val) → skip, writeIndex=2
- Return 2, nums = [2,2,3,3] (first 2 elements are valid) ✓

