# Subtree of Another Tree (LeetCode #572)

**Category**: Tree, DFS, String Matching
**Difficulty**: Easy
**Status**: ✅ Implemented in C#, TypeScript, JavaScript

## Problem Statement
Given the roots of two binary trees `root` and `subRoot`, return `true` if there is a subtree of `root` with the same structure and node values of `subRoot` and `false` otherwise.

A subtree of a binary tree `tree` is a tree that consists of a node in `tree` and all of this node's descendants. The tree `tree` could also be considered as a subtree of itself.

## Example
**Input**: root = [3,4,5,1,2], subRoot = [4,1,2]  
**Output**: true

**Input**: root = [3,4,5,1,2,null,null,null,null,0], subRoot = [4,1,2]  
**Output**: false

## Approach
- Use DFS to traverse the root tree
- For each node in root, check if the subtree starting from that node is identical to subRoot
- Use a helper function `isSameTree` to check if two trees are identical
- Recursively check left and right subtrees
- Time complexity: `O(m * n)` where m is nodes in root, n is nodes in subRoot
- Space complexity: `O(h)` where h is height of root tree (recursion stack)

## Key Insight
This is a two-step problem:
1. **Find potential matches**: Traverse root tree, check if any node matches subRoot's root value
2. **Verify structure**: For each potential match, check if the entire subtree is identical

The helper function `isSameTree` checks:
- Both null → identical
- One null, one not → not identical
- Different values → not identical
- Recursively check left and right subtrees

## Example Walkthrough
For `root = [3,4,5,1,2]`, `subRoot = [4,1,2]`:
- Start at root (3): Not same as subRoot (4) → check children
- Check left subtree (4):
  - `isSameTree(4, 4)`: val matches
  - `isSameTree(1, 1)`: val matches
  - `isSameTree(2, 2)`: val matches
  - All match → return true ✓

## Alternative Approach (Serialization)
- Serialize both trees to strings
- Check if subRoot's serialization is substring of root's serialization
- More complex but can be O(m + n) with KMP algorithm
- Current approach is simpler and easier to understand

## Common Mistakes

1. **Not checking all nodes**: Must check every node in root, not just root itself
2. **Wrong comparison logic**: Must check structure AND values, not just values
3. **Edge cases**: Handle null root and null subRoot correctly
4. **Not using helper function**: Makes code cleaner and easier to understand

## Tree Traversal Pattern

This problem uses:
- **DFS (Depth-First Search)**: Traverse root tree
- **Tree Comparison**: Compare two trees recursively
- **Recursive Pattern**: Base case + recursive case

