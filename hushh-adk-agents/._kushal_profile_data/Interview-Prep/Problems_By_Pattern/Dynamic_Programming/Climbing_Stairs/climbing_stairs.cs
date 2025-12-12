public class Solution {
    public int ClimbStairs(int n) {
        if (n <= 2) return n;
        
        int prev2 = 1;  // F(1)
        int prev1 = 2;  // F(2)
        
        for (int i = 3; i <= n; i++) {
            int current = prev1 + prev2;
            prev2 = prev1;
            prev1 = current;
        }
        
        return prev1;
    }
}
