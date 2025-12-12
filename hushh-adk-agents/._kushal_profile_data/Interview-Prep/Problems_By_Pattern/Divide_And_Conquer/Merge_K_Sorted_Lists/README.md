# Merge k Sorted Lists (LeetCode #23)

**Category**: Linked List, Divide and Conquer, Heap (Priority Queue)
**Difficulty**: Hard
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.
Merge all the linked-lists into one sorted linked-list and return it.

## Example

**Input**: lists = [[1,4,5],[1,3,4],[2,6]]
**Output**: [1,1,2,3,4,4,5,6]
**Explanation**: The linked-lists are:
[
1->4->5,
1->3->4,
2->6
]
merging them into one sorted list:
1->1->2->3->4->4->5->6

## Approach 1: Brute Force (User's Approach)

- Collect all values from all lists into an array.
- Sort the array.
- Create a new linked list from the sorted values.
- **Time Complexity**: O(N log N) where N is total nodes.
- **Space Complexity**: O(N) to store values.

## Approach 2: Divide and Conquer (Optimized)

- Pair up `k` lists and merge each pair.
- After the first round, we have `k/2` lists.
- Repeat until we have only one list.
- This is similar to Merge Sort.
- **Time Complexity**: O(N log k).
- **Space Complexity**: O(1) (iterative) or O(log k) (recursive stack).

## Approach 3: Min-Heap (Priority Queue)

- Maintain a min-heap of size `k`.
- Add the head of each list to the heap.
- Extract the minimum, add it to result, and add the next node from that list to the heap.
- **Time Complexity**: O(N log k).
- **Space Complexity**: O(k).

## Key Insight

- Merging two sorted lists is O(n).
- By merging pairs iteratively, we reduce the number of merges logarithmically.

## Common Mistakes

1.  **Merging one by one**: Merging list 1 with 2, then result with 3, etc. This is O(kN) which is slow.
2.  **Not handling null lists**: Some lists in the input array might be null.
