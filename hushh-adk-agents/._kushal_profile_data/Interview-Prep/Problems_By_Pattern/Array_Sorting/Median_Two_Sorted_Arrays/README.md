# Median of Two Sorted Arrays (LeetCode #4)

**Category**: Binary Search, Arrays
**Difficulty**: Hard
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays.

The overall run time complexity should be `O(log (m+n))`.

## Example
**Input**: nums1 = [1,3], nums2 = [2]  
**Output**: 2.00000  
**Explanation**: merged array = [1,2,3] and median is 2.

**Input**: nums1 = [1,2], nums2 = [3,4]  
**Output**: 2.50000  
**Explanation**: merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.

## Approach
- Use binary search on the smaller array to find the correct partition
- Partition both arrays such that all elements on the left are less than all elements on the right
- The median is found when the partition is correct
- Time complexity: `O(log(min(m, n)))`
- Space complexity: `O(1)`

## Key Insight
Instead of merging the arrays (which would be O(m+n)), we use binary search to find the partition point that divides both arrays into left and right halves where:
- All elements in the left half ≤ all elements in the right half
- The left and right halves have equal (or nearly equal) sizes

