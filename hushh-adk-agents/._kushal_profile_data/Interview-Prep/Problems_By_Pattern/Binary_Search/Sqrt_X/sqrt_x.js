// Sqrt(x) - JavaScript implementation
// Time Complexity: O(log(x))
// Space Complexity: O(1)

function mySqrt(x) {
  if (x === 0 || x === 1) {
    return x;
  }

  let left = 1;
  let right = Math.floor(x / 2);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const square = mid * mid;

    if (square === x) {
      return mid;
    } else if (square < x) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Return right because we want the floor value
  // When loop ends, right is the largest integer whose square <= x
  return right;
}

module.exports = { mySqrt };
