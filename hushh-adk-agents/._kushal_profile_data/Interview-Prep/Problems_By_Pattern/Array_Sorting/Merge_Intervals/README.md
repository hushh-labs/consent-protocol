# Merge Intervals (LeetCode #56)

**Category**: Array, Sorting
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 62.5%

## Problem Statement

Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return _an array of the non-overlapping intervals that cover all the intervals in the input_.

## Example

**Input**: intervals = [[1,3],[2,6],[8,10],[15,18]]
**Output**: [[1,6],[8,10],[15,18]]
**Explanation**: Since intervals [1,3] and [2,6] overlap, merge them into [1,6].

**Input**: intervals = [[1,4],[4,5]]
**Output**: [[1,5]]
**Explanation**: Intervals [1,4] and [4,5] are considered overlapping.

## Approach: Sort + Merge (One Pass)

The key insight is to **sort first by start time**, then merge in a single pass.

### Algorithm

1. **Sort** intervals by start time: `intervals.sort((a, b) => a[0] - b[0])`
2. **Initialize** result with first interval: `merged = [intervals[0]]`
3. **Iterate** through remaining intervals:
   - If current interval **overlaps** with last merged interval (`current[0] <= lastMerged[1]`):
     - **Merge**: Extend the end to `max(lastMerged[1], current[1])`
   - Else:
     - **Add** current interval as a new separate interval
4. Return merged intervals

### Why Sorting Works

After sorting by start time:

- If `current[0] <= lastMerged[1]`, they **must** overlap (because current starts before/at the end of last)
- We only need to look at the **previous** interval, not all previous intervals

## Complexity

- **Time Complexity**: O(N log N) - dominated by sorting
- **Space Complexity**: O(N) - for the result array (or O(log N) if we don't count output)

## Common Mistakes

1. **Forgetting to sort**: Without sorting, you can't determine overlaps in one pass
2. **Wrong overlap condition**: Use `current[0] <= lastMerged[1]`, not `<`
3. **Wrong merge logic**: Take `max(lastMerged[1], current[1])`, not just `current[1]`
4. **Not handling edge cases**: Empty array, single interval

## Key Insight

**Overlap condition**: `current[0] <= lastMerged[1]`

- Two intervals `[a,b]` and `[c,d]` overlap if `c <= b` (assuming `a <= c` after sorting)
- When merging, the new end is `max(b, d)` to handle cases like `[1,4]` and `[2,3]`
