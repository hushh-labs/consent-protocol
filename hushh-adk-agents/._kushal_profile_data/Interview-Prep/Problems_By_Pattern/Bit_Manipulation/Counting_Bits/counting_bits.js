/**
 * LeetCode #338: Counting Bits
 * https://leetcode.com/problems/counting-bits/
 * 
 * Difficulty: Easy
 * 
 * Problem: Given an integer n, return an array ans of length n + 1 such that 
 * for each i (0 <= i <= n), ans[i] is the number of 1's in the binary representation of i.
 */

/**
 * OPTIMIZED SOLUTION: Least Significant Bit (Most Common)
 * Time: O(n)
 * Space: O(1)
 * 
 * Logic:
 * Number of set bits in 'i' is:
 * - (i & 1): is the last bit 1? (0 or 1)
 * - ans[i >> 1]: number of set bits in i/2
 * 
 * Example: 
 * 7 (111) -> 7>>1 is 3 (011). bits(7) = bits(3) + 1 = 2 + 1 = 3.
 * 6 (110) -> 6>>1 is 3 (011). bits(6) = bits(3) + 0 = 2 + 0 = 2.
 * 
 * @param {number} n
 * @return {number[]}
 */
var countBits = function(n) {
    const ans = new Array(n + 1).fill(0);
    
    for (let i = 1; i <= n; i++) {
        // i >> 1 is equivalent to Math.floor(i / 2)
        // i & 1 is equivalent to i % 2
        ans[i] = ans[i >> 1] + (i & 1);
    }
    
    return ans;
};

// Test
// console.log(countBits(5)); // [0,1,1,2,1,2]
