# Longest Palindromic Substring (LeetCode #5)

**Category**: String, Dynamic Programming, Two Pointers
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

Given a string `s`, return the longest palindromic substring in `s`.

## Example

**Input**: s = "babad"
**Output**: "bab"
**Note**: "aba" is also a valid answer.

**Input**: s = "cbbd"
**Output**: "bb"

## Approach: Expand Around Center

A palindrome mirrors around its center. Therefore, a palindrome can be expanded from its center, and there are only `2n - 1` such centers.
You might ask why there are `2n - 1` but not `n` centers? The reason is the center of a palindrome can be in between two letters. Such palindromes have even number of letters (such as "abba") and its center are between the two 'b's.

1.  Iterate through each character `i` in the string.
2.  Consider `i` as the center for odd-length palindromes (expand from `i, i`).
3.  Consider `i` and `i+1` as the center for even-length palindromes (expand from `i, i+1`).
4.  Keep track of the maximum length found and the starting index.

## Complexity

- **Time Complexity**: O(N^2). Expanding a palindrome around its center could take O(N) time, and we do this for each of the 2N-1 centers.
- **Space Complexity**: O(1). We only need a few variables to store the start and max length.

## Alternative Approaches

1.  **Dynamic Programming**: O(N^2) time and O(N^2) space. Create a table `dp[i][j]` true if `s[i..j]` is a palindrome.
2.  **Manacher's Algorithm**: O(N) time. Complex to implement in an interview setting but good to know it exists.

## Key Insight

- Handle both odd (`aba`) and even (`abba`) length palindromes by expanding from `i` (single character center) and `i, i+1` (two character center).
