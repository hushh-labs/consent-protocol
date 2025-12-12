# Container With Most Water (LeetCode #11)

**Category**: Array, Two Pointers, Greedy
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i-th` line are `(i, 0)` and `(i, height[i])`.

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return _the maximum amount of water a container can store_.

## Example

**Input**: height = [1,8,6,2,5,4,8,3,7]
**Output**: 49
**Explanation**: The max area is between index 1 (height 8) and index 8 (height 7).
Width = 8 - 1 = 7.
Height = min(8, 7) = 7.
Area = 7 \* 7 = 49.

## Approach: Two Pointers (Greedy)

The brute force approach is to check every pair of lines ($O(N^2)$), which is too slow.
We can use a **Two Pointer** approach to solve this in $O(N)$.

1.  Start with pointers at the **beginning** (`left = 0`) and **end** (`right = n - 1`) of the array.
2.  Calculate the area: `min(height[left], height[right]) * (right - left)`.
3.  Update the maximum area found so far.
4.  **Move the pointer pointing to the shorter line** inward.
    - Why? The area is limited by the shorter line. If we move the taller line, the width decreases, and the height can't possibly increase (it's limited by the shorter one we kept). The only way to potentially find a larger area is to try and find a taller line to replace the current short one.
5.  Repeat until `left` meets `right`.

## Complexity

- **Time Complexity**: O(N). We traverse the array once.
- **Space Complexity**: O(1). We only use a few variables.

## Key Insight

- **Greedy Choice**: Always move the shorter line. Moving the taller line can never increase the area because the width decreases and the height is still limited by the shorter line.
