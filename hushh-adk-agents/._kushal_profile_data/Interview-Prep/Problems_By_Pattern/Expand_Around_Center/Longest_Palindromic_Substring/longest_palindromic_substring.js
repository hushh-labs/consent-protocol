/**
 * @param {string} s
 * @return {string}
 */
var longestPalindrome = function(s) {
    if (!s || s.length < 1) return "";
    
    let start = 0;
    let end = 0;
    
    for (let i = 0; i < s.length; i++) {
        // Expand for odd length (e.g., "aba")
        let len1 = expandAroundCenter(s, i, i);
        // Expand for even length (e.g., "abba")
        let len2 = expandAroundCenter(s, i, i + 1);
        
        let len = Math.max(len1, len2);
        
        // If we found a longer palindrome, update start and end
        if (len > end - start) {
            // Calculate new start and end based on center i and length
            // Example: i=2, len=3 ("aba"). start = 2 - (2)/2 = 1. end = 2 + 3/2 = 3.
            // Example: i=2, len=4 ("abba"). start = 2 - (3)/2 = 1. end = 2 + 4/2 = 4.
            start = i - Math.floor((len - 1) / 2);
            end = i + Math.floor(len / 2);
        }
    }
    
    return s.substring(start, end + 1);
};

function expandAroundCenter(s, left, right) {
    while (left >= 0 && right < s.length && s[left] === s[right]) {
        left--;
        right++;
    }
    // Return length. Note: right - left - 1 because pointers expanded one step too far
    return right - left - 1;
}
