# Edit Distance (LeetCode #72)

**Category**: Dynamic Programming, String
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 50%

## Problem Statement

Given two strings `word1` and `word2`, return the minimum number of operations required to convert `word1` to `word2`.

You have the following three operations permitted on a word:

- **Insert** a character
- **Delete** a character
- **Replace** a character

## Example

**Input**: word1 = "horse", word2 = "ros"
**Output**: 3
**Explanation**:

- horse → rorse (replace 'h' with 'r')
- rorse → rose (remove 'r')
- rose → ros (remove 'e')

**Input**: word1 = "intention", word2 = "execution"
**Output**: 5
**Explanation**:

- intention → inention (remove 't')
- inention → enention (replace 'i' with 'e')
- enention → exention (replace 'n' with 'x')
- exention → exection (replace 'n' with 'c')
- exection → execution (insert 'u')

## Approach: 2D Dynamic Programming

**Key insight**: Build a table where `dp[i][j]` = minimum operations to convert `word1[0...i-1]` to `word2[0...j-1]`

### Recurrence Relation

```
If word1[i-1] == word2[j-1]:
    dp[i][j] = dp[i-1][j-1]  // Characters match, no operation needed
Else:
    dp[i][j] = 1 + min(
        dp[i-1][j],    // Delete from word1
        dp[i][j-1],    // Insert into word1
        dp[i-1][j-1]   // Replace
    )
```

### Base Cases

- `dp[0][j] = j` (insert j characters)
- `dp[i][0] = i` (delete i characters)

## Complexity

- **Time Complexity**: O(M × N) where M, N are string lengths
- **Space Complexity**: O(M × N) for DP table

## Common Mistakes

1. **Wrong indexing** - Remember dp[i][j] uses word1[i-1] and word2[j-1]
2. **Forgetting base cases** - Initialize first row and column
3. **Wrong recurrence** - Must consider all 3 operations when characters differ
