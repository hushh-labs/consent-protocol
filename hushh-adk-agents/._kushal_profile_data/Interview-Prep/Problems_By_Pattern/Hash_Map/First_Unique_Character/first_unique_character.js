/**
 * @param {string} s
 * @return {number}
 * 
 * OPTIMIZED APPROACH: Map with Index Tracking
 * - First pass: Build map storing { index, count } for each character
 * - Second pass: Iterate over MAP (at most 26 entries) instead of string (N chars)
 * - Time: O(N) for first pass + O(26) for second pass = O(N)
 * - Space: O(26) = O(1)
 * - Advantage: For very long strings (N >> 26), iterating map is faster than string
 */
var firstUniqChar = function(s) {
    let map = new Map();

    // First pass: Build frequency map with indices
    for(let i = 0; i < s.length; i++)
    {
        if(!map.has(s[i]))
        {
            map.set(s[i], {
                index: i,
                count: 1 
            });
        }
        else
        {
            let obj = map.get(s[i]);
            obj.count = obj.count + 1;
        }
    }

    // Second pass: Iterate over map (26 keys max) to find first unique
    for (const [key, value] of map) {
        if (value.count === 1) {
            return value.index;
        }
    }
    
    return -1;
};
