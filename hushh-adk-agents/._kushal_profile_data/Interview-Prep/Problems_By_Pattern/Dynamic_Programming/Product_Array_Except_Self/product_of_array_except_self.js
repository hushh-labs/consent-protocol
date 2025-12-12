// Product of Array Except Self - JavaScript implementation
// Time Complexity: O(n) where n is the length of nums
// Space Complexity: O(1) excluding the output array

function productExceptSelf(nums) {
  const n = nums.length;
  const result = new Array(n);

  // First pass: Calculate left products and store in result
  result[0] = 1;
  for (let i = 1; i < n; i++) {
    result[i] = result[i - 1] * nums[i - 1];
  }

  // Second pass: Calculate right products and multiply with left products
  let rightProduct = 1;
  for (let i = n - 1; i >= 0; i--) {
    result[i] = result[i] * rightProduct;
    rightProduct = rightProduct * nums[i];
  }

  return result;
}

module.exports = { productExceptSelf };
