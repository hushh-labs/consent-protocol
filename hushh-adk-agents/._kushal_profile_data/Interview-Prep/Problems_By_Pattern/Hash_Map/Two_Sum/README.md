# Two Sum (LeetCode #1)

**Category**: Arrays & Hash Map
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

## Approach
- Use a hash map / dictionary to store the value and its index.
- For each number, compute the complement (`target - nums[i]`).
- If the complement is already in the dictionary, return the indices.
- Time complexity: `O(n)`
- Space complexity: `O(n)`
