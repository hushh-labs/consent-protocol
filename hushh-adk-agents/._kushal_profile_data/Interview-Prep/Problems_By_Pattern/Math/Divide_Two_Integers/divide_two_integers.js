// Divide Two Integers - JavaScript implementation
// Time Complexity: O(log(n)) where n is the dividend
// Space Complexity: O(1)

function divide(dividend, divisor) {
    const INT_MAX = Math.pow(2, 31) - 1;
    const INT_MIN = -Math.pow(2, 31);

    // Handle edge case: dividend is INT_MIN and divisor is -1
    if (dividend === INT_MIN && divisor === -1) {
        return INT_MAX;
    }

    // Determine sign of result
    const isNegative = (dividend < 0) !== (divisor < 0);
    
    // Work with absolute values
    let absDividend = Math.abs(dividend);
    let absDivisor = Math.abs(divisor);
    
    let quotient = 0;

    // Use exponential search: double the divisor until it's too large
    while (absDividend >= absDivisor) {
        let tempDivisor = absDivisor;
        let multiple = 1;

        // Keep doubling the divisor until it exceeds the dividend
        // Example: if divisor=3 and dividend=10
        // Start: 3, then 6, then 12 (too big, so use 6)
        while (absDividend >= tempDivisor * 2 && tempDivisor * 2 > 0) {
            tempDivisor = tempDivisor * 2; // Double the divisor
            multiple = multiple * 2;        // Double the multiple
        }

        // Subtract the largest multiple we found
        absDividend = absDividend - tempDivisor;
        quotient = quotient + multiple;
    }

    // Apply sign and check bounds
    const result = isNegative ? -quotient : quotient;
    
    if (result > INT_MAX) return INT_MAX;
    if (result < INT_MIN) return INT_MIN;
    
    return result;
}

module.exports = { divide };

