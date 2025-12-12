public class Solution {
    public int LengthOfLongestSubstring(string s) {
        var charSet = new HashSet<char>();
        int left = 0;
        int maxLen = 0;
        
        for (int right = 0; right < s.Length; right++) {
            // Shrink window while duplicate exists
            while (charSet.Contains(s[right])) {
                charSet.Remove(s[left]);
                left++;
            }
            
            // Add current character
            charSet.Add(s[right]);
            
            // Update max length
            maxLen = Math.Max(maxLen, right - left + 1);
        }
        
        return maxLen;
    }
}
