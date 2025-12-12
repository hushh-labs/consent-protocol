// Remove Element - JavaScript implementation
// Time Complexity: O(n) where n is the length of nums array
// Space Complexity: O(1)

function removeElement(nums, val) {
  let writeIndex = 0;

  for (let i = 0; i < nums.length; i++) {
    // If current element is not the value to remove, keep it
    if (nums[i] !== val) {
      nums[writeIndex] = nums[i];
      writeIndex++;
    }
    // If current element equals val, skip it (don't increment writeIndex)
  }

  return writeIndex;
}

module.exports = { removeElement };
