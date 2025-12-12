// Two Sum - TypeScript implementation
// Time Complexity: O(n)
// Space Complexity: O(n)

export function twoSum(nums: number[], target: number): number[] {
    const indexByValue = new Map<number, number>();

    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];

        if (indexByValue.has(complement)) {
            return [indexByValue.get(complement)!, i];
        }

        if (!indexByValue.has(nums[i])) {
            indexByValue.set(nums[i], i);
        }
    }

    return [];
}
