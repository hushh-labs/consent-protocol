// Add Binary - C# implementation
// Time Complexity: O(max(m, n)) where m and n are the lengths of a and b
// Space Complexity: O(max(m, n)) for the result string

public class Solution
{
    public string AddBinary(string a, string b)
    {
        int i = a.Length - 1;
        int j = b.Length - 1;
        int carry = 0;
        var result = new System.Collections.Generic.List<char>();

        // Process from right to left (least significant to most significant)
        while (i >= 0 || j >= 0 || carry > 0)
        {
            int digitA = i >= 0 ? a[i] - '0' : 0;
            int digitB = j >= 0 ? b[j] - '0' : 0;

            int sum = digitA + digitB + carry;
            result.Add((char)((sum % 2) + '0'));
            carry = sum / 2;

            i--;
            j--;
        }

        // Reverse to get the correct order (most significant first)
        result.Reverse();
        return new string(result.ToArray());
    }
}

