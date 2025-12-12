// Search Insert Position - JavaScript implementation
// Time Complexity: O(log(n))
// Space Complexity: O(1)

function searchInsert(nums, target) {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (nums[mid] === target) {
      return mid;
    } else if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // If target not found, left is the insertion position
  return left;
}

module.exports = { searchInsert };
