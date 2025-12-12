# Kth Largest Element in an Array (LeetCode #215)

**Category**: Array, Heap, Divide and Conquer, Quick Select
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 50%

## Problem Statement

Given an integer array `nums` and an integer `k`, return the `kth` largest element in the array.

Note that it is the `kth` largest element in the sorted order, not the `kth` distinct element.

Can you solve it without sorting?

## Example

**Input**: nums = [3,2,1,5,6,4], k = 2
**Output**: 5

**Input**: nums = [3,2,3,1,2,4,5,5,6], k = 4
**Output**: 4

## Approaches

### Approach 1: Sorting (Simple but not optimal)

Sort and return `nums[nums.length - k]`

- **Time**: O(N log N)
- **Space**: O(1)

### Approach 2: Min Heap (Optimal for interviews)

Maintain a min heap of size `k`. The root is the kth largest!

- **Time**: O(N log k)
- **Space**: O(k)

### Approach 3: Quick Select (Best complexity)

Partitioning algorithm similar to Quick Sort

- **Time**: O(N) average, O(N²) worst
- **Space**: O(1)

## Solution: Min Heap Approach

**Key Insight**: Keep a heap of the `k` largest elements. The smallest element in this heap is the kth largest overall!

### Algorithm

1. Build a min heap of size `k` with first `k` elements
2. For remaining elements:
   - If element > heap root (min of heap):
     - Remove root
     - Add element
3. Heap root is the kth largest

## Complexity

- **Time Complexity**: O(N log k) - N elements, each heap operation is log k
- **Space Complexity**: O(k) - heap size

## JavaScript Note

JavaScript doesn't have a built-in heap, so we show both:

1. **Simple sort** - O(N log N) but clean
2. **Manual heap** - O(N log k) optimal

## Common Mistakes

1. **Confusing min heap vs max heap** - We need MIN heap of size k!
2. **Off-by-one**: kth largest, not kth smallest
3. **Using max heap** - Would need to pop k elements, less efficient
