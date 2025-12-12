# Algorithm Patterns - Quick Reference

**Use this during the interview for quick pattern lookup**

---

## Pattern Recognition Table

| Keywords                     | Pattern        | Time       | Space |
| :--------------------------- | :------------- | :--------- | :---- |
| "Find pair/sum to target"    | Hash Map       | O(N)       | O(N)  |
| "Sorted array"               | Two Pointers   | O(N)       | O(1)  |
| "Substring with property"    | Sliding Window | O(N)       | O(K)  |
| "Maximum/minimum subarray"   | DP (Kadane's)  | O(N)       | O(1)  |
| "How many ways to..."        | DP (Fibonacci) | O(N)       | O(1)  |
| "Merge intervals"            | Sorting        | O(N log N) | O(N)  |
| "Kth largest/smallest"       | Heap           | O(N log K) | O(K)  |
| "Valid parentheses/brackets" | Stack          | O(N)       | O(N)  |

---

## Hash Map Template

```javascript
const map = new Map();
for (let i = 0; i < nums.length; i++) {
  const complement = target - nums[i];
  if (map.has(complement)) {
    return [map.get(complement), i];
  }
  map.set(nums[i], i);
}
```

**Use when**: Need O(1) lookup, frequency counting

---

## Two Pointers Template

```javascript
let left = 0,
  right = nums.length - 1;
while (left < right) {
  if (condition) {
    left++;
  } else {
    right--;
  }
}
```

**Use when**: Sorted array, palindrome, pair problems

---

## Sliding Window Template

```javascript
let left = 0,
  maxLen = 0;
const window = new Set();

for (let right = 0; right < s.length; right++) {
  while (window.has(s[right])) {
    window.delete(s[left]);
    left++;
  }
  window.add(s[right]);
  maxLen = Math.max(maxLen, right - left + 1);
}
```

**Use when**: Substring/subarray with property

---

## Dynamic Programming - Kadane's Algorithm

```javascript
let maxSum = nums[0];
let currentSum = nums[0];

for (let i = 1; i < nums.length; i++) {
  currentSum = Math.max(nums[i], currentSum + nums[i]);
  maxSum = Math.max(maxSum, currentSum);
}
```

**Use when**: Maximum subarray sum

---

## Dynamic Programming - Fibonacci Pattern

```javascript
if (n <= 2) return n;

let prev2 = 1,
  prev1 = 2;
for (let i = 3; i <= n; i++) {
  const current = prev1 + prev2;
  prev2 = prev1;
  prev1 = current;
}
return prev1;
```

**Use when**: "How many ways to reach..."

---

## Sorting - Merge Intervals

```javascript
intervals.sort((a, b) => a[0] - b[0]);
const merged = [intervals[0]];

for (let i = 1; i < intervals.length; i++) {
  const last = merged[merged.length - 1];
  const curr = intervals[i];

  if (curr[0] <= last[1]) {
    last[1] = Math.max(last[1], curr[1]);
  } else {
    merged.push(curr);
  }
}
```

**Use when**: Interval/range problems

---

## Heap - Kth Largest (Simple Sort)

```javascript
nums.sort((a, b) => b - a);
return nums[k - 1];
```

**Use when**: Kth largest/smallest (sort is fine unless asked to optimize)

---

## Stack - Valid Parentheses

```javascript
const stack = [];
const pairs = { ")": "(", "}": "{", "]": "[" };

for (const char of s) {
  if (pairs[char]) {
    if (stack.length === 0 || stack.pop() !== pairs[char]) {
      return false;
    }
  } else {
    stack.push(char);
  }
}
return stack.length === 0;
```

**Use when**: Matching pairs, nested structures

---

## Emergency Pattern Identification

**If you blank**, ask yourself:

1. "Do I need fast lookup?" → Hash Map
2. "Is the array sorted?" → Two Pointers or Binary Search
3. "Is this about a substring?" → Sliding Window
4. "Can I build from smaller solutions?" → Dynamic Programming
5. "Do I need to match pairs?" → Stack

---

**Trust your preparation. You know these patterns.** 🎯
