/**
 * @param {number[][]} intervals
 * @return {number[][]}
 *
 * APPROACH: Sort + Merge in One Pass
 * - Sort intervals by start time
 * - Iterate and merge overlapping intervals
 * - Time: O(N log N) for sorting
 * - Space: O(N) for result
 */
var merge = function (intervals) {
  // Edge case: empty or single interval
  if (intervals.length <= 1) return intervals;

  // STEP 1: Sort by start time
  intervals.sort((a, b) => a[0] - b[0]);

  // STEP 2: Initialize result with first interval
  const merged = [intervals[0]];

  // STEP 3: Merge overlapping intervals
  for (let i = 1; i < intervals.length; i++) {
    const lastMerged = merged[merged.length - 1];
    const current = intervals[i];

    // Check if current overlaps with last merged interval
    if (current[0] <= lastMerged[1]) {
      // Merge: extend the end to the max of both
      lastMerged[1] = Math.max(lastMerged[1], current[1]);
    } else {
      // No overlap: add as new interval
      merged.push(current);
    }
  }

  return merged;
};

// Example usage:
// console.log(merge([[1,3],[2,6],[8,10],[15,18]])); // [[1,6],[8,10],[15,18]]
// console.log(merge([[1,4],[4,5]]));                 // [[1,5]]
