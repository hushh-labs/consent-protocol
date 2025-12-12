// Subtree of Another Tree - JavaScript implementation
// Time Complexity: O(m * n) where m is nodes in root, n is nodes in subRoot
// Space Complexity: O(h) where h is height of root tree

// Definition for a binary tree node.
function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}

function isSubtree(root, subRoot) {
  if (subRoot === null) return true; // Empty subtree is always a subtree
  if (root === null) return false; // Empty tree can't contain non-empty subtree

  // Check if current tree is identical to subRoot
  if (isSameTree(root, subRoot)) {
    return true;
  }

  // Recursively check left and right subtrees
  return isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);
}

// Helper function to check if two trees are identical
function isSameTree(p, q) {
  if (p === null && q === null) return true;
  if (p === null || q === null) return false;
  if (p.val !== q.val) return false;

  return isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
}

module.exports = { isSubtree, TreeNode };
