/**
 * @param {number[]} nums
 * @return {number}
 *
 * OPTIMAL APPROACH: Boyer-Moore Voting Algorithm
 * - Cancellation principle: majority element survives after cancellations
 * - Time: O(N)
 * - Space: O(1)
 */
var majorityElement = function (nums) {
  let candidate = null;
  let count = 0;

  // Find candidate using voting
  for (const num of nums) {
    if (count === 0) {
      candidate = num;
    }

    count += num === candidate ? 1 : -1;
  }

  // Problem guarantees majority element exists, so candidate is the answer
  return candidate;
};

/**
 * ALTERNATIVE APPROACH: Hash Map
 * - Simple but uses O(N) space
 * - Time: O(N), Space: O(N)
 */
var majorityElementHashMap = function (nums) {
  const freq = new Map();
  const majority = Math.floor(nums.length / 2);

  for (const num of nums) {
    freq.set(num, (freq.get(num) || 0) + 1);
    if (freq.get(num) > majority) {
      return num;
    }
  }
};

// Example usage:
// console.log(majorityElement([3,2,3])); // 3
// console.log(majorityElement([2,2,1,1,1,2,2])); // 2
