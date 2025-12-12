public class Solution {
    /**
     * Approach: Dynamic Programming (Least Significant Bit)
     * Time Complexity: O(n)
     * Space Complexity: O(1) (excluding return array)
     */
    public int[] CountBits(int n) {
        int[] ans = new int[n + 1];
        
        for (int i = 1; i <= n; i++) {
            // ans[i] = ans[i / 2] + (i % 2)
            // i >> 1 is i / 2
            // i & 1 is i % 2
            ans[i] = ans[i >> 1] + (i & 1);
        }
        
        return ans;
    }
}
