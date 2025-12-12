# Maximum Subarray (LeetCode #53)

**Category**: Array, Dynamic Programming, Divide and Conquer
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 62.5%

## Problem Statement

Given an integer array `nums`, find the subarray with the largest sum, and return _its sum_.

## Example

**Input**: nums = [-2,1,-3,4,-1,2,1,-5,4]
**Output**: 6
**Explanation**: The subarray [4,-1,2,1] has the largest sum 6.

**Input**: nums = [1]
**Output**: 1

**Input**: nums = [5,4,-1,7,8]
**Output**: 23

## Approach: Kadane's Algorithm (Dynamic Programming)

**Key Insight**: At each position, decide whether to **extend the current subarray** or **start a new one**.

### Algorithm

1. Initialize `maxSum` and `currentSum` to `nums[0]`
2. For each element from index 1:
   - **Decision**: `currentSum = max(nums[i], currentSum + nums[i])`
     - If `nums[i]` alone is bigger than `currentSum + nums[i]`, start fresh
     - Otherwise, extend the current subarray
   - **Update global max**: `maxSum = max(maxSum, currentSum)`
3. Return `maxSum`

### Why It Works

- `currentSum` tracks the maximum sum of subarrays **ending at the current position**
- If adding the current element makes the sum worse than starting fresh, we start fresh
- We track the global maximum across all positions

## Complexity

- **Time Complexity**: O(N) - single pass through the array
- **Space Complexity**: O(1) - only two variables

## Common Mistakes

1. **Using nested loops** - O(N²) approach times out
2. **Not handling all negatives** - Initialize both variables to `nums[0]`, not 0
3. **Forgetting the edge case** - Single element array

## Brute Force (Why It Fails)

```javascript
// O(N²) - TOO SLOW
for (let i = 0; i < nums.length; i++) {
  let sum = 0;
  for (let j = i; j < nums.length; j++) {
    sum += nums[j];
    maxSum = Math.max(maxSum, sum);
  }
}
```

For `N = 10,000`, this is 100 million operations!

## Key Pattern

This is the **Kadane's Algorithm** pattern - any "maximum/minimum subarray sum" problem likely uses this approach.
