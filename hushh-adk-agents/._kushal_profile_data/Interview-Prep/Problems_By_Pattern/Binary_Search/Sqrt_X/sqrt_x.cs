// Sqrt(x) - C# implementation
// Time Complexity: O(log(x))
// Space Complexity: O(1)

public class Solution
{
    public int MySqrt(int x)
    {
        if (x == 0 || x == 1)
        {
            return x;
        }

        int left = 1;
        int right = x / 2;

        while (left <= right)
        {
            int mid = (left + right) / 2;
            long square = (long)mid * mid; // Use long to prevent overflow

            if (square == x)
            {
                return mid;
            }
            else if (square < x)
            {
                left = mid + 1;
            }
            else
            {
                right = mid - 1;
            }
        }

        // Return right because we want the floor value
        // When loop ends, right is the largest integer whose square <= x
        return right;
    }
}

