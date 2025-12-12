public class Solution {
    public int MaxSubArray(int[] nums) {
        int maxSum = nums[0];
        int currentSum = nums[0];
        
        for (int i = 1; i < nums.Length; i++) {
            // Extend current subarray OR start fresh
            currentSum = Math.Max(nums[i], currentSum + nums[i]);
            
            // Update global maximum
            maxSum = Math.Max(maxSum, currentSum);
        }
        
        return maxSum;
    }
}
