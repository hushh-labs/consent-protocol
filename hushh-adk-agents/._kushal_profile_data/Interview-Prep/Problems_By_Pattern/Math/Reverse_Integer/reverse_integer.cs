// Reverse Integer - C# implementation
// Time Complexity: O(log(x)) where x is the input number
// Space Complexity: O(1)

public class Solution
{
    private static int HighestPlaceValue(int n)
    {
        if (n == 0) return 0;
        int num = Math.Abs(n);
        int digits = (int)Math.Floor(Math.Log10(num)) + 1;
        return (int)Math.Pow(10, digits - 1);
    }

    public int Reverse(int x)
    {
        if (x == 0) return 0;

        bool isNegative = x < 0;
        int num = Math.Abs(x);
        int placeValue = HighestPlaceValue(num);
        int reversed = 0;
        int temp = num;
        const int INT_MAX = int.MaxValue;
        const int INT_MIN = int.MinValue;

        while (temp > 0)
        {
            int digit = temp % 10;
            long contribution = (long)digit * placeValue;

            // Check for overflow before adding
            if (reversed > INT_MAX - (int)contribution)
            {
                return 0;
            }
            reversed += (int)contribution;

            temp /= 10;
            placeValue /= 10;
        }

        return isNegative ? -reversed : reversed;
    }
}

