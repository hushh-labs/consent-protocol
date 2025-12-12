// Two Sum - C# implementation
// Time Complexity: O(n)
// Space Complexity: O(n)

public class Solution
{
    public int[] TwoSum(int[] nums, int target)
    {
        if (nums == null || nums.Length < 2)
        {
            return Array.Empty<int>();
        }

        var indexByValue = new Dictionary<int, int>();

        for (int i = 0; i < nums.Length; i++)
        {
            int complement = target - nums[i];

            if (indexByValue.TryGetValue(complement, out int index))
            {
                return new[] { index, i };
            }

            if (!indexByValue.ContainsKey(nums[i]))
            {
                indexByValue[nums[i]] = i;
            }
        }

        return Array.Empty<int>();
    }
}
