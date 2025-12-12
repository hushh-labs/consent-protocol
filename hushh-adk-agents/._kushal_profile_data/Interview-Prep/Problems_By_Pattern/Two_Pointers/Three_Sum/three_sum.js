/**
 * @param {number[]} nums
 * @return {number[][]}
 *
 * APPROACH: Sort + Two Pointers
 * - Sort array first
 * - Fix one element (i), use two pointers for remaining two
 * - Skip duplicates to avoid duplicate triplets
 * - Time: O(N²) - O(N log N) sort + O(N) × O(N) two pointers
 * - Space: O(1) ignoring output
 */
var threeSum = function (nums) {
  const result = [];

  // Sort for two pointers approach
  nums.sort((a, b) => a - b);

  // Fix first element
  for (let i = 0; i < nums.length - 2; i++) {
    // Skip duplicate values for i
    if (i > 0 && nums[i] === nums[i - 1]) continue;

    // Two pointers for remaining elements
    let left = i + 1;
    let right = nums.length - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];

      if (sum === 0) {
        // Found triplet
        result.push([nums[i], nums[left], nums[right]]);

        // Skip duplicates for left
        while (left < right && nums[left] === nums[left + 1]) {
          left++;
        }
        // Skip duplicates for right
        while (left < right && nums[right] === nums[right - 1]) {
          right--;
        }

        // Move both pointers
        left++;
        right--;
      } else if (sum < 0) {
        // Sum too small, move left pointer right
        left++;
      } else {
        // Sum too large, move right pointer left
        right--;
      }
    }
  }

  return result;
};

// Example usage:
// console.log(threeSum([-1,0,1,2,-1,-4])); // [[-1,-1,2],[-1,0,1]]
// console.log(threeSum([0,1,1]));          // []
// console.log(threeSum([0,0,0]));          // [[0,0,0]]
