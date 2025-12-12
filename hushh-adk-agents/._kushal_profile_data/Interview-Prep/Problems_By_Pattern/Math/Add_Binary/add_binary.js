// Add Binary - JavaScript implementation
// Time Complexity: O(max(m, n)) where m and n are the lengths of a and b
// Space Complexity: O(max(m, n)) for the result string

function addBinary(a, b) {
  let i = a.length - 1;
  let j = b.length - 1;
  let carry = 0;
  const result = [];

  // Process from right to left (least significant to most significant)
  while (i >= 0 || j >= 0 || carry > 0) {
    const digitA = i >= 0 ? parseInt(a[i]) : 0;
    const digitB = j >= 0 ? parseInt(b[j]) : 0;

    const sum = digitA + digitB + carry;
    result.push((sum % 2).toString());
    carry = Math.floor(sum / 2);

    i--;
    j--;
  }

  // Reverse to get the correct order (most significant first)
  return result.reverse().join("");
}

module.exports = { addBinary };
