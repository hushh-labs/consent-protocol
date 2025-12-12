# Complete Patterns Study Guide

**Use this tonight to review ALL patterns and your problems**

---

## Your 18 Practiced Problems (by difficulty)

### ✅ Easy (Master These)

1. Two Sum (Hash Map)
2. Valid Parentheses (Stack)
3. Climbing Stairs (DP)
4. Valid Palindrome (Two Pointers)
5. Best Time to Buy/Sell Stock (Greedy)
6. Remove Element (Two Pointers)
7. Search Insert Position (Binary Search)

### ✅ Medium (Practice Explaining)

8. 3Sum (Two Pointers + Sorting)
9. Longest Substring Without Repeating (Sliding Window)
10. Maximum Subarray (DP - Kadane's)
11. Merge Intervals (Sorting)
12. Container With Most Water (Two Pointers)
13. Kth Largest Element (Heap)
14. First Unique Character (Hash Map)
15. Majority Element (Array)
16. Coin Change (DP - Knapsack)
17. Edit Distance (DP - 2D)
18. Merge K Sorted Lists (Divide & Conquer)

---

## Pattern 1: Hash Map 🗺️

### When to Use

- Need O(1) lookup
- Frequency counting
- Finding pairs (Two Sum)
- Grouping elements

### Your Problems

- ✅ Two Sum (#1) - Find pair that sums to target
- ✅ First Unique Character (#387) - Frequency counting

### Template

```javascript
// Two Sum pattern
const map = new Map();
for (let i = 0; i < nums.length; i++) {
  const complement = target - nums[i];
  if (map.has(complement)) {
    return [map.get(complement), i];
  }
  map.set(nums[i], i);
}

// Frequency counting
const freq = new Map();
for (const item of arr) {
  freq.set(item, (freq.get(item) || 0) + 1);
}
```

**Time**: O(N) | **Space**: O(N)

---

## Pattern 2: Two Pointers 👈👉

### When to Use

- **Sorted array**
- Palindrome problems
- Pair sum problems
- In-place manipulation

### Your Problems

- ✅ 3Sum (#15) - Find triplets that sum to 0
- ✅ Container With Most Water (#11) - Max area
- ✅ Remove Element (#27) - In-place removal
- ✅ Valid Palindrome (#125) - Check palindrome

### Template

```javascript
// Two pointers from both ends
let left = 0,
  right = nums.length - 1;
while (left < right) {
  if (condition) {
    left++;
  } else {
    right--;
  }
}

// Fast/slow pointers (same direction)
let slow = 0;
for (let fast = 0; fast < nums.length; fast++) {
  if (shouldKeep(nums[fast])) {
    nums[slow] = nums[fast];
    slow++;
  }
}
```

**Time**: O(N) | **Space**: O(1)

---

## Pattern 3: Sliding Window 🪟

### When to Use

- Substring/subarray problems
- "Longest/shortest with property"
- Variable or fixed window size

### Your Problems

- ✅ Longest Substring Without Repeating (#3) - Variable window

### Template

```javascript
let left = 0,
  maxLen = 0;
const window = new Set();

for (let right = 0; right < s.length; right++) {
  // Shrink window while condition violated
  while (window.has(s[right])) {
    window.delete(s[left]);
    left++;
  }

  window.add(s[right]);
  maxLen = Math.max(maxLen, right - left + 1);
}
```

**Time**: O(N) | **Space**: O(K) where K = window size

---

## Pattern 4: Dynamic Programming 💡

### When to Use

- "How many ways..."
- Optimization (max/min)
- Can break into smaller subproblems

### Sub-Pattern A: Kadane's Algorithm (Maximum Subarray)

**Your Problem**: Maximum Subarray (#53)

```javascript
let maxSum = nums[0];
let currentSum = nums[0];

for (let i = 1; i < nums.length; i++) {
  // Extend current OR start fresh
  currentSum = Math.max(nums[i], currentSum + nums[i]);
  maxSum = Math.max(maxSum, currentSum);
}
```

**Time**: O(N) | **Space**: O(1)

### Sub-Pattern B: Fibonacci Variant

**Your Problem**: Climbing Stairs (#70)

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

**Time**: O(N) | **Space**: O(1)

### Sub-Pattern C: Unbounded Knapsack

**Your Problem**: Coin Change (#322)

```javascript
const dp = new Array(amount + 1).fill(Infinity);
dp[0] = 0;

for (let i = 1; i <= amount; i++) {
  for (const coin of coins) {
    if (coin <= i) {
      dp[i] = Math.min(dp[i], dp[i - coin] + 1);
    }
  }
}

return dp[amount] === Infinity ? -1 : dp[amount];
```

**Time**: O(amount × coins) | **Space**: O(amount)

### Sub-Pattern D: 2D DP

**Your Problem**: Edit Distance (#72)

```javascript
const dp = Array(m + 1)
  .fill(0)
  .map(() => Array(n + 1).fill(0));

// Base cases
for (let i = 0; i <= m; i++) dp[i][0] = i;
for (let j = 0; j <= n; j++) dp[0][j] = j;

// Fill table
for (let i = 1; i <= m; i++) {
  for (let j = 1; j <= n; j++) {
    if (word1[i - 1] === word2[j - 1]) {
      dp[i][j] = dp[i - 1][j - 1];
    } else {
      dp[i][j] =
        1 +
        Math.min(
          dp[i - 1][j], // Delete
          dp[i][j - 1], // Insert
          dp[i - 1][j - 1] // Replace
        );
    }
  }
}
```

**Time**: O(M × N) | **Space**: O(M × N)

---

## Pattern 5: Sorting/Array 📊

### When to Use

- Intervals/ranges
- Need to process in order

### Your Problems

- ✅ Merge Intervals (#56) - Merge overlapping intervals
- ✅ Majority Element (#169) - Boyer-Moore voting

### Template (Merge Intervals)

```javascript
intervals.sort((a, b) => a[0] - b[0]);
const merged = [intervals[0]];

for (let i = 1; i < intervals.length; i++) {
  const last = merged[merged.length - 1];
  const curr = intervals[i];

  if (curr[0] <= last[1]) {
    // Overlap - merge
    last[1] = Math.max(last[1], curr[1]);
  } else {
    // No overlap
    merged.push(curr);
  }
}
```

**Time**: O(N log N) | **Space**: O(N)

---

## Pattern 6: Heap/Priority Queue 🏔️

### When to Use

- Kth largest/smallest
- Top K elements
- Merge K sorted

### Your Problems

- ✅ Kth Largest Element (#215) - Simple: sort and return kth
- ✅ Merge K Sorted Lists (#23) - Divide & conquer

### Simple Approach (Kth Largest)

```javascript
// For interviews, sorting is fine
nums.sort((a, b) => b - a);
return nums[k - 1];
```

**Time**: O(N log N) | **Space**: O(1)

---

## Pattern 7: Stack 📚

### When to Use

- Matching pairs (parentheses)
- LIFO operations
- Valid sequences

### Your Problems

- ✅ Valid Parentheses (#20)

### Template

```javascript
const stack = [];
const pairs = { ")": "(", "}": "{", "]": "[" };

for (const char of s) {
  if (pairs[char]) {
    // Closing bracket
    if (stack.length === 0 || stack.pop() !== pairs[char]) {
      return false;
    }
  } else {
    // Opening bracket
    stack.push(char);
  }
}

return stack.length === 0;
```

**Time**: O(N) | **Space**: O(N)

---

## Pattern 8: Greedy 🎯

### When to Use

- Optimization where local optimum = global
- No need to reconsider choices

### Your Problems

- ✅ Best Time to Buy/Sell Stock (#121)

### Template

```javascript
let minPrice = nums[0];
let maxProfit = 0;

for (let i = 1; i < nums.length; i++) {
  minPrice = Math.min(minPrice, nums[i]);
  maxProfit = Math.max(maxProfit, nums[i] - minPrice);
}
```

**Time**: O(N) | **Space**: O(1)

---

## Pattern 9: Binary Search 🔍

### When to Use

- **Sorted array**
- Need O(log N) time

### Your Problems

- ✅ Search Insert Position (#35)

### Template

```javascript
let left = 0,
  right = nums.length - 1;

while (left <= right) {
  const mid = Math.floor((left + right) / 2);

  if (nums[mid] === target) {
    return mid;
  } else if (nums[mid] < target) {
    left = mid + 1;
  } else {
    right = mid - 1;
  }
}

return left; // Insert position
```

**Time**: O(log N) | **Space**: O(1)

---

## Quick Pattern Matching

| Problem Says...             | Think Pattern                 |
| :-------------------------- | :---------------------------- |
| "Find pair that sums to X"  | Hash Map                      |
| "Array is sorted"           | Two Pointers or Binary Search |
| "Longest substring with..." | Sliding Window                |
| "Maximum subarray sum"      | DP (Kadane's)                 |
| "How many ways to..."       | DP (Fibonacci)                |
| "Merge intervals"           | Sorting + Merge               |
| "Kth largest"               | Heap (or just sort)           |
| "Valid parentheses"         | Stack                         |
| "Single buy/sell"           | Greedy                        |

---

## Tonight's Review Plan

**6:00-7:30 PM** (90 min total):

1. Read through ALL patterns above (10 min each pattern)
2. For each pattern, review YOUR problems listed
3. Make sure you can explain the template

**Don't solve new problems. Just review what you know.**

---

**You've got this. These are YOUR patterns now.** 🎯
