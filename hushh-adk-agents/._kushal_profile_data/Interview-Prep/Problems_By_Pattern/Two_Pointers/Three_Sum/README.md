# 3Sum (LeetCode #15)

**Category**: Array, Two Pointers, Sorting
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 50%

## Problem Statement

Given an integer array `nums`, return all the triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.

**Notice**: The solution set must not contain duplicate triplets.

## Example

**Input**: nums = [-1,0,1,2,-1,-4]
**Output**: [[-1,-1,2],[-1,0,1]]
**Explanation**:

- nums[0] + nums[1] + nums[2] = (-1) + 0 + 1 = 0.
- nums[1] + nums[2] + nums[4] = 0 + 1 + (-1) = 0.
- nums[0] + nums[3] + nums[4] = (-1) + 2 + (-1) = 0.
  The distinct triplets are [-1,0,1] and [-1,-1,2].

**Input**: nums = [0,1,1]
**Output**: []

**Input**: nums = [0,0,0]
**Output**: [[0,0,0]]

## Approach: Sort + Two Pointers

**Key Insight**: Fix one element, then use Two Pointers to find pairs that sum to the negation of the fixed element (turn 3Sum into 2Sum).

### Algorithm

1. **Sort** the array: `nums.sort((a, b) => a - b)`
2. **Iterate** through array (fix first element `i`):
   - Skip duplicates for `i`
   - Use **two pointers** (`left = i + 1`, `right = n - 1`) to find pairs:
     - If `sum === 0`: Found triplet! Add to result
       - Skip duplicates for `left` and `right`
     - If `sum < 0`: Move `left` right
     - If `sum > 0`: Move `right` left
3. Return all unique triplets

### Why Sorting Helps

After sorting, we can:

- Use two pointers efficiently (O(N) for each fixed element)
- Skip duplicates easily (check if current == previous)
- Guarantee unique triplets

## Complexity

- **Time Complexity**: O(N²) - O(N log N) for sort + O(N) × O(N) for two pointers
- **Space Complexity**: O(1) or O(N) depending on sorting (ignoring output array)

## Common Mistakes

1. **Forgetting to skip duplicates** - Results in duplicate triplets
2. **Not sorting first** - Two pointers won't work correctly
3. **Wrong duplicate skip logic** - Must skip duplicates for ALL three positions
4. **Off-by-one errors** - Check `i < nums.length - 2` for outer loop

## Key Pattern

This extends **Two Sum II** (sorted array + two pointers) to 3Sum by fixing one element and finding pairs for the remaining two.
