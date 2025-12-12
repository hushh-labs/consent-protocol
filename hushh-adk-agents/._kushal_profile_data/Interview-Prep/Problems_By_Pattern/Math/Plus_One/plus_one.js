// Plus One - JavaScript implementation
// Time Complexity: O(n) where n is the length of digits array
// Space Complexity: O(1) excluding output array

function plusOne(digits) {
  // Start from the rightmost digit
  for (let i = digits.length - 1; i >= 0; i--) {
    // If digit is less than 9, just increment and return
    if (digits[i] < 9) {
      digits[i]++;
      return digits;
    }
    // If digit is 9, set it to 0 and continue (carry over)
    digits[i] = 0;
  }

  // If we reach here, all digits were 9
  // We need to add a new digit 1 at the beginning
  return [1, ...digits];
}

module.exports = { plusOne };

plusOne([1, 2, 3]);
