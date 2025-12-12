# First Unique Character in a String (LeetCode #387)

**Category**: String, Hash Map, Queue
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

Given a string `s`, find the **first** non-repeating character in it and return its index. If it does not exist, return `-1`.

## Example

**Input**: s = "leetcode"
**Output**: 0
**Explanation**: The character 'l' at index 0 is the first character that does not occur at any other index.

**Input**: s = "loveleetcode"
**Output**: 2
**Explanation**: The character 'l' repeats, 'o' repeats. 'v' at index 2 is the first unique character.

**Input**: s = "aabb"
**Output**: -1

## Approach: Frequency Map (Two Pass)

1.  **First Pass**: Iterate through the string and count the frequency of each character. Store this in a Hash Map (or an array of size 26 for lowercase English letters).
2.  **Second Pass**: Iterate through the string again. For each character, check its count in the map.
3.  **Result**: The first character with a count of `1` is our answer. Return its index.
4.  If we finish the loop without finding a unique character, return `-1`.

## Complexity

- **Time Complexity**: O(N). We traverse the string twice. $O(N) + O(N) = O(N)$.
- **Space Complexity**: O(1). The map/array stores at most 26 characters (constant size), regardless of string length.

## Key Insight

- We need to know the frequency of _every_ character before we can decide if the _first_ character is unique. That's why we need the first pass.
- Using an array `int[26]` is slightly faster than a generic Hash Map for this specific problem because the keys are limited to 'a'-'z'.
