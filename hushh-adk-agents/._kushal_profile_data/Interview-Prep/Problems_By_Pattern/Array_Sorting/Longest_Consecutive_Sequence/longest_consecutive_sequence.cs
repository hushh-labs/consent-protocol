// Longest Consecutive Sequence - C# implementation
// Time Complexity: O(n) where n is the length of nums
// Space Complexity: O(n)

public class Solution
{
    public int LongestConsecutive(int[] nums)
    {
        if (nums == null || nums.Length == 0)
        {
            return 0;
        }

        var numSet = new HashSet<int>(nums);
        int maxLength = 0;

        foreach (int num in numSet)
        {
            // Only start counting if this is the beginning of a sequence
            // (i.e., num - 1 is not in the set)
            if (!numSet.Contains(num - 1))
            {
                int currentNum = num;
                int currentLength = 1;

                // Count consecutive numbers
                while (numSet.Contains(currentNum + 1))
                {
                    currentNum++;
                    currentLength++;
                }

                maxLength = Math.Max(maxLength, currentLength);
            }
        }

        return maxLength;
    }
}

