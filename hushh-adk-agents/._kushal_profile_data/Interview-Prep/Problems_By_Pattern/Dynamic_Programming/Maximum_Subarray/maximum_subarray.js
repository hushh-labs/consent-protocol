/**
 * @param {number[]} nums
 * @return {number}
 *
 * APPROACH: Kadane's Algorithm (Dynamic Programming)
 * - At each position, decide: extend current subarray OR start new?
 * - currentSum = max sum ending at current position
 * - maxSum = global maximum across all positions
 * - Time: O(N) - single pass
 * - Space: O(1) - two variables
 */
var maxSubArray = function (nums) {
  let maxSum = nums[0]; // Global maximum
  let currentSum = nums[0]; // Maximum sum ending at current position

  for (let i = 1; i < nums.length; i++) {
    // Key decision: extend current subarray OR start fresh?
    // If nums[i] alone is better than currentSum + nums[i], start fresh
    currentSum = Math.max(nums[i], currentSum + nums[i]);

    // Update global maximum
    maxSum = Math.max(maxSum, currentSum);
  }

  return maxSum;
};

// Example usage:
// console.log(maxSubArray([-2,1,-3,4,-1,2,1,-5,4])); // 6
// console.log(maxSubArray([1]));                      // 1
// console.log(maxSubArray([5,4,-1,7,8]));            // 23
