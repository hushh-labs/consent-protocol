# Majority Element (LeetCode #169)

**Category**: Array, Hash Map, Voting Algorithm
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript
**Deloitte Frequency**: 50%

## Problem Statement

Given an array `nums` of size `n`, return the **majority element**.

The majority element is the element that appears **more than ⌊n / 2⌋ times**. You may assume that the majority element always exists in the array.

## Example

**Input**: nums = [3,2,3]
**Output**: 3

**Input**: nums = [2,2,1,1,1,2,2]
**Output**: 2

## Approaches

### Approach 1: Hash Map (Simple)

Count frequencies, return element with count > n/2

**Time**: O(N) | **Space**: O(N)

### Approach 2: Boyer-Moore Voting Algorithm (Optimal)

The key insight: If we cancel out each occurrence of an element with all other elements that are different, the majority element will remain.

**Time**: O(N) | **Space**: O(1)

## Algorithm (Boyer-Moore)

1. Maintain a `candidate` and `count`
2. For each element:
   - If `count == 0`, set current element as candidate
   - If current element == candidate, increment count
   - Else decrement count
3. Return candidate

**Why it works**: The majority element appears more than n/2 times, so even after all cancellations, it will remain.

## Complexity

- **Time Complexity**: O(N) - single pass
- **Space Complexity**: O(1) - only two variables

## Common Mistakes

1. **Using Hash Map when O(1) space required** - Boyer-Moore is better
2. **Not understanding why it works** - Know the cancellation logic
3. **Forgetting problem guarantees** - Problem states majority element ALWAYS exists
