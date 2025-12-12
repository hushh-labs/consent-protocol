// Divide Two Integers - C# implementation
// Time Complexity: O(log(n)) where n is the dividend
// Space Complexity: O(1)

public class Solution
{
    public int Divide(int dividend, int divisor)
    {
        const int INT_MAX = int.MaxValue;
        const int INT_MIN = int.MinValue;

        // Handle edge case: dividend is INT_MIN and divisor is -1
        if (dividend == INT_MIN && divisor == -1)
        {
            return INT_MAX;
        }

        // Determine sign of result
        bool isNegative = (dividend < 0) != (divisor < 0);

        // Work with absolute values (handle INT_MIN carefully)
        long absDividend = Math.Abs((long)dividend);
        long absDivisor = Math.Abs((long)divisor);

        int quotient = 0;

        // Use exponential search: double the divisor until it's too large
        while (absDividend >= absDivisor)
        {
            long tempDivisor = absDivisor;
            int multiple = 1;

            // Keep doubling the divisor until it exceeds the dividend
            // Example: if divisor=3 and dividend=10
            // Start: 3, then 6, then 12 (too big, so use 6)
            while (absDividend >= tempDivisor * 2 && tempDivisor * 2 > 0)
            {
                tempDivisor = tempDivisor * 2; // Double the divisor
                multiple = multiple * 2;        // Double the multiple
            }

            // Subtract the largest multiple we found
            absDividend = absDividend - tempDivisor;
            quotient = quotient + multiple;
        }

        // Apply sign
        return isNegative ? -quotient : quotient;
    }
}

