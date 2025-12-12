/**
 * @param {string} s
 * @return {number}
 *
 * APPROACH: Sliding Window + Hash Set
 * - Maintain window [left, right] with unique characters
 * - Expand right: add new character
 * - If duplicate found: shrink left until duplicate removed
 * - Each character visited at most twice
 * - Time: O(N)
 * - Space: O(min(m, n)) where m = charset size
 */
var lengthOfLongestSubstring = function (s) {
  const charSet = new Set();
  let left = 0;
  let maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    // Shrink window from left while duplicate exists
    while (charSet.has(s[right])) {
      charSet.delete(s[left]);
      left++;
    }

    // Add current character to window
    charSet.add(s[right]);

    // Update maximum length
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
};

// Example usage:
// console.log(lengthOfLongestSubstring("abcabcbb")); // 3 ("abc")
// console.log(lengthOfLongestSubstring("bbbbb"));    // 1 ("b")
// console.log(lengthOfLongestSubstring("pwwkew"));   // 3 ("wke")
