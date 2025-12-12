# Longest Substring Without Repeating Characters (LeetCode #3)

**Category**: String, Hash Set, Sliding Window
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 50%

## Problem Statement

Given a string `s`, find the length of the **longest substring** without repeating characters.

## Example

**Input**: s = "abcabcbb"
**Output**: 3
**Explanation**: The answer is "abc", with the length of 3.

**Input**: s = "bbbbb"
**Output**: 1
**Explanation**: The answer is "b", with the length of 1.

**Input**: s = "pwwkew"
**Output**: 3
**Explanation**: The answer is "wke", with the length of 3. Note that "pwke" is a subsequence, not a substring.

## Approach: Sliding Window + Hash Set

**Key Insight**: Maintain a **window** `[left, right]` of unique characters. When a duplicate is found, shrink from the left until it's removed.

### Algorithm

1. Use a `Set` to track characters in current window
2. Use two pointers: `left` and `right`
3. Expand window by moving `right`:
   - **While** `s[right]` is in the set (duplicate):
     - Remove `s[left]` from set
     - Move `left` forward
   - Add `s[right]` to set
   - Update max length
4. Each character is visited at most **twice** (once by right, once by left)

## Complexity

- **Time Complexity**: O(N) - each character visited at most twice
- **Space Complexity**: O(min(m, n)) where m is charset size (26 for lowercase letters)

## Why Brute Force Fails

```javascript
// O(N²) - TOO SLOW
for (let i = 0; i < s.length; i++) {
  let set = new Set();
  for (let j = i; j < s.length; j++) {
    if (set.has(s[j])) break;
    set.add(s[j]);
  }
}
```

This recalculates overlapping substrings repeatedly!

## Key Pattern

**Sliding Window** - Any "longest/shortest substring with property" problem likely uses this pattern:

- Expand window to satisfy condition
- Shrink window when condition violated
- Track optimal length
