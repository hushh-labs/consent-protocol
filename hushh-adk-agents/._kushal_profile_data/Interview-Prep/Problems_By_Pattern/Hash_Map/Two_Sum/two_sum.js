// Two Sum - JavaScript implementation
// Time Complexity: O(n)
// Space Complexity: O(n)

function twoSum(nums, target) {
    const indexByValue = new Map();

    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];

        if (indexByValue.has(complement)) {
            return [indexByValue.get(complement), i];
        }

        if (!indexByValue.has(nums[i])) {
            indexByValue.set(nums[i], i);
        }
    }

    return [];
}

module.exports = { twoSum };
