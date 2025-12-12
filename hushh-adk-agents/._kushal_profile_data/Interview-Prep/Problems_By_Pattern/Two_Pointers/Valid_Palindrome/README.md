# Valid Palindrome (LeetCode #125)

**Category**: String, Two Pointers
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: Not in verified list (general practice)

## Problem Statement

A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string `s`, return `true` if it is a palindrome, or `false` otherwise.

## Example

**Input**: s = "A man, a plan, a canal: Panama"
**Output**: true
**Explanation**: "amanaplanacanalpanama" is a palindrome.

**Input**: s = "race a car"
**Output**: false
**Explanation**: "raceacar" is not a palindrome.

**Input**: s = " "
**Output**: true
**Explanation**: After removing non-alphanumeric characters, s becomes an empty string "". Empty string is a palindrome.

## Approach: Two Pointers

1. Use two pointers: `left` starting at 0, `right` starting at end
2. Skip non-alphanumeric characters from both ends
3. Compare characters (case-insensitive)
4. If mismatch found, return false
5. If pointers meet, return true

## Complexity

- **Time Complexity**: O(N) - single pass through string
- **Space Complexity**: O(1) - only two pointers

## Common Mistakes

1. **Forgetting to skip non-alphanumeric** - Must check `isalnum()`
2. **Not handling case** - Must convert to lowercase
3. **Creating modified string** - Wastes O(N) space, use pointers instead
