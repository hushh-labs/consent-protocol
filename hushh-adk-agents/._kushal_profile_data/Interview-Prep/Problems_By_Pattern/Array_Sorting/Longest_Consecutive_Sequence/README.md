# Longest Consecutive Sequence (LeetCode #128)

**Category**: Array, Hash Set, Union Find
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given an unsorted array of integers `nums`, return the length of the longest consecutive elements sequence.

You must write an algorithm that runs in `O(n)` time.

## Example
**Input**: nums = [100,4,200,1,3,2]  
**Output**: 4  
**Explanation**: The longest consecutive elements sequence is [1, 2, 3, 4]. Therefore its length is 4.

**Input**: nums = [0,3,7,2,5,8,4,6,0,1]  
**Output**: 9

## Approach
- Use HashSet to store all numbers for O(1) lookup
- For each number, check if it's the start of a sequence (num - 1 doesn't exist)
- If it's the start, count how long the consecutive sequence is by checking num + 1, num + 2, etc.
- Track the maximum length found
- Time complexity: `O(n)` - each number is visited at most twice
- Space complexity: `O(n)` for the HashSet

## Key Insight
The trick is to only start counting from the beginning of each sequence:
- If `num - 1` exists in the set, then `num` is not the start of a sequence
- Only count sequences starting from numbers where `num - 1` doesn't exist
- This ensures each number is part of exactly one sequence, visited at most twice

## Example Walkthrough
For `nums = [100,4,200,1,3,2]`:
- HashSet: {100, 4, 200, 1, 3, 2}
- Check 100: 99 not in set → start sequence, count: 100 (length 1)
- Check 4: 3 in set → skip (not start)
- Check 200: 199 not in set → start sequence, count: 200 (length 1)
- Check 1: 0 not in set → start sequence, count: 1,2,3,4 (length 4)
- Check 3: 2 in set → skip
- Check 2: 1 in set → skip
- Maximum length: 4 ✓

## Alternative Approaches

### Sorting Approach (O(n log n))
```csharp
Array.Sort(nums);
// Then count consecutive sequences
```
- Simpler but slower: O(n log n) time
- Not optimal for O(n) requirement

### Union-Find Approach
- More complex, same O(n) time
- Overkill for this problem

## Common Mistakes

1. **Sorting first**: O(n log n) violates O(n) requirement
2. **Not checking if start of sequence**: Would count same sequence multiple times
3. **Using List.Contains**: O(n) lookup instead of O(1) with HashSet
4. **Not handling empty array**: Edge case to consider

