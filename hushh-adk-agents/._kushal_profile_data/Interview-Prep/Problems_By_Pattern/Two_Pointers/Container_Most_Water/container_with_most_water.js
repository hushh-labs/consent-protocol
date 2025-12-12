/**
 * @param {number[]} height
 * @return {number}
 */
var maxArea = function(height) {
    let left = 0;
    let right = height.length - 1;
    let maxWater = 0;
    
    while (left < right) {
        // Calculate current area
        // Height is limited by the shorter of the two lines
        let h = Math.min(height[left], height[right]);
        let w = right - left;
        let area = h * w;
        
        maxWater = Math.max(maxWater, area);
        
        // Move the pointer of the shorter line inward
        // We want to try and find a taller line to potentially increase area
        if (height[left] < height[right]) {
            left++;
        } else {
            right--;
        }
    }
    
    return maxWater;
};
