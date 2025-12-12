// Remove Element - C# implementation
// Time Complexity: O(n) where n is the length of nums array
// Space Complexity: O(1)

public class Solution
{
    public int RemoveElement(int[] nums, int val)
    {
        int writeIndex = 0;

        for (int i = 0; i < nums.Length; i++)
        {
            // If current element is not the value to remove, keep it
            if (nums[i] != val)
            {
                nums[writeIndex] = nums[i];
                writeIndex++;
            }
            // If current element equals val, skip it (don't increment writeIndex)
        }

        return writeIndex;
    }
}

