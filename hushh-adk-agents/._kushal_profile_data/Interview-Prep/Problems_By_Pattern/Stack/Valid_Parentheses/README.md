# Valid Parentheses (LeetCode #20)

**Category**: Stack, String
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement

Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.

An input string is valid if:

1.  Open brackets must be closed by the same type of brackets.
2.  Open brackets must be closed in the correct order.
3.  Every close bracket has a corresponding open bracket of the same type.

## Example

**Input**: s = "()"
**Output**: true

**Input**: s = "()[]{}"
**Output**: true

**Input**: s = "(]"
**Output**: false

## Approach: Stack

The classic approach to solve this problem is using a **Stack**.

1.  Iterate through the string.
2.  If we encounter an opening bracket (`(`, `{`, `[`), push it onto the stack.
3.  If we encounter a closing bracket:
    - Check if the stack is empty. If so, it's invalid (no matching opening bracket).
    - Pop the top element from the stack.
    - Check if the popped element matches the current closing bracket. If not, it's invalid.
4.  After the loop, if the stack is empty, the string is valid. If not, there are unmatched opening brackets.

## Complexity

- **Time Complexity**: O(N), where N is the length of the string. We traverse the string once.
- **Space Complexity**: O(N) in the worst case (e.g., "((((("), where we push all characters onto the stack.

## Common Mistakes

- Not checking if the stack is empty before popping.
- Returning `true` immediately inside the loop (must wait until the end).
- Forgetting to check if the stack is empty at the very end (e.g., "(()").
