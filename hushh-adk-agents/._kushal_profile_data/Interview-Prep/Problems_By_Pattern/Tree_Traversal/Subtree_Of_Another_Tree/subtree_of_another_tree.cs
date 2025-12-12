// Subtree of Another Tree - C# implementation
// Time Complexity: O(m * n) where m is nodes in root, n is nodes in subRoot
// Space Complexity: O(h) where h is height of root tree

// Definition for a binary tree node.
public class TreeNode
{
    public int val;
    public TreeNode left;
    public TreeNode right;
    public TreeNode(int val = 0, TreeNode left = null, TreeNode right = null)
    {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

public class Solution
{
    public bool IsSubtree(TreeNode root, TreeNode subRoot)
    {
        if (subRoot == null) return true; // Empty subtree is always a subtree
        if (root == null) return false; // Empty tree can't contain non-empty subtree

        // Check if current tree is identical to subRoot
        if (IsSameTree(root, subRoot))
        {
            return true;
        }

        // Recursively check left and right subtrees
        return IsSubtree(root.left, subRoot) || IsSubtree(root.right, subRoot);
    }

    // Helper function to check if two trees are identical
    private bool IsSameTree(TreeNode p, TreeNode q)
    {
        if (p == null && q == null) return true;
        if (p == null || q == null) return false;
        if (p.val != q.val) return false;

        return IsSameTree(p.left, q.left) && IsSameTree(p.right, q.right);
    }
}

