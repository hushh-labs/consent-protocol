public class Solution {
    public int MaxArea(int[] height) {
        int left = 0;
        int right = height.Length - 1;
        int maxWater = 0;
        
        while (left < right) {
            // Calculate area: min(height) * width
            int h = Math.Min(height[left], height[right]);
            int w = right - left;
            int area = h * w;
            
            maxWater = Math.Max(maxWater, area);
            
            // Move the shorter line inward
            if (height[left] < height[right]) {
                left++;
            } else {
                right--;
            }
        }
        
        return maxWater;
    }
}
