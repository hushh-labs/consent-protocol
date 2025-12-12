// Plus One - C# implementation
// Time Complexity: O(n) where n is the length of digits array
// Space Complexity: O(1) excluding output array

public class Solution
{
    public int[] PlusOne(int[] digits)
    {
        // Start from the rightmost digit
        for (int i = digits.Length - 1; i >= 0; i--)
        {
            // If digit is less than 9, just increment and return
            if (digits[i] < 9)
            {
                digits[i]++;
                return digits;
            }
            // If digit is 9, set it to 0 and continue (carry over)
            digits[i] = 0;
        }

        // If we reach here, all digits were 9
        // We need to add a new digit 1 at the beginning
        int[] result = new int[digits.Length + 1];
        result[0] = 1;
        return result;
    }
}

