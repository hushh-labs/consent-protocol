# Add Two Numbers (LeetCode #2)

**Category**: Linked Lists
**Difficulty**: Medium
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

You may assume the two numbers do not contain any leading zero, except the number 0 itself.

## Example
**Input**: l1 = [2,4,3], l2 = [5,6,4]  
**Output**: [7,0,8]  
**Explanation**: 342 + 465 = 807

## Approach
- Use a dummy head node to simplify the result list construction
- Traverse both lists simultaneously, adding corresponding digits
- Handle carry-over when sum exceeds 9
- Continue until both lists are exhausted and no carry remains
- Time complexity: `O(max(m, n))` where m and n are the lengths of the two lists
- Space complexity: `O(max(m, n))` for the result list

