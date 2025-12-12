public class Solution {
    public int FirstUniqChar(string s) {
        // Use an array for O(1) access since we only have lowercase English letters
        int[] count = new int[26];
        
        // First pass: Count frequencies
        foreach (char c in s) {
            count[c - 'a']++;
        }
        
        // Second pass: Find first unique character
        for (int i = 0; i < s.Length; i++) {
            if (count[s[i] - 'a'] == 1) {
                return i;
            }
        }
        
        return -1;
    }
}
