# Complete Algorithm Patterns Guide

**Comprehensive reference covering ALL interview patterns**
**Last Updated**: November 28, 2025

---

## Quick Pattern Recognition Table

| Problem Keywords             | Pattern                       | Example           |
| :--------------------------- | :---------------------------- | :---------------- |
| "Find pair/sum to target"    | Hash Map                      | Two Sum           |
| "Sorted array"               | Two Pointers or Binary Search | 3Sum, Search      |
| "Substring with property"    | Sliding Window                | Longest Substring |
| "Maximum/minimum subarray"   | Dynamic Programming           | Maximum Subarray  |
| "How many ways to..."        | Dynamic Programming           | Climbing Stairs   |
| "Merge intervals"            | Sorting                       | Merge Intervals   |
| "Kth largest/smallest"       | Heap                          | Kth Largest       |
| "Valid parentheses/brackets" | Stack                         | Valid Parentheses |
| "Generate all combinations"  | Backtracking                  | Permutations      |
| "Shortest path/connected"    | Graph BFS/DFS                 | Number of Islands |

---

## Pattern 1: Hash Map/Dictionary 📍

### When to Use

- **O(1) lookup** needed
- Frequency counting
- Finding pairs (Two Sum)
- Checking existence
- Grouping elements

### Problem Recognition

✅ "Find if exists"
✅ "Count occurrences"
✅ "Find pairs that sum to X"
✅ "Group by property"

### Template

```javascript
// Frequency counting
const freq = new Map();
for (const num of nums) {
  freq.set(num, (freq.get(num) || 0) + 1);
}

// Two Sum pattern
const map = new Map();
for (let i = 0; i < nums.length; i++) {
  const complement = target - nums[i];
  if (map.has(complement)) {
    return [map.get(complement), i];
  }
  map.set(nums[i], i);
}
```

### Your Problems

- ✅ Two Sum (#1) - 87.5% freq
- ✅ First Unique Character (#387) - 75% freq

**Time**: O(N) | **Space**: O(N)

---

## Pattern 2: Two Pointers 📍

### When to Use

- **Sorted array**
- Palindrome problems
- Pair sum in sorted array
- In-place array manipulation

### Problem Recognition

✅ "Sorted array"
✅ "Palindrome"
✅ "Two elements that..."
✅ "Remove duplicates in-place"

### Templates

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

### Your Problems

- ✅ Container With Most Water (#11) - 75% freq
- ✅ Remove Element (#27)
- ✅ 3Sum (#15) - 50% freq

**Time**: O(N) | **Space**: O(1)

---

## Pattern 3: Sliding Window 📍

### When to Use

- **Substring/subarray** problems
- "Longest/shortest with property"
- Variable or fixed window size

### Problem Recognition

✅ "Substring"
✅ "Subarray"
✅ "Window"
✅ "Longest/shortest with condition"

### Template

```javascript
// Variable window
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

### Your Problems

- ✅ Longest Substring Without Repeating (#3) - 50% freq

**Time**: O(N) | **Space**: O(K) where K = window size

---

## Pattern 4: Dynamic Programming 📍

### When to Use

- **"How many ways"** questions
- **Optimization** problems (max/min)
- Overlapping subproblems
- Can break into smaller same problems

### Problem Recognition

✅ "Maximum/minimum"
✅ "How many ways to..."
✅ "Longest/shortest sequence"
✅ Can build solution from smaller solutions

### Common DP Patterns

#### A. Kadane's Algorithm (Maximum Subarray)

```javascript
let maxSum = nums[0];
let currentSum = nums[0];

for (let i = 1; i < nums.length; i++) {
  // Extend current OR start fresh
  currentSum = Math.max(nums[i], currentSum + nums[i]);
  maxSum = Math.max(maxSum, currentSum);
}
```

#### B. Fibonacci Variant (Climbing Stairs)

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

#### C. Unbounded Knapsack (Coin Change)

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

### Your Problems

- ✅ Maximum Subarray (#53) - 62.5% freq (Kadane's)
- ✅ Climbing Stairs (#70) - 50% freq (Fibonacci)
- ✅ Coin Change (#322) - 50% freq (Knapsack)
- ✅ Product of Array Except Self (#238)

**Time**: Usually O(N) or O(N²) | **Space**: O(N) or O(1) if optimized

---

## Pattern 5: Sorting/Array Manipulation 📍

### When to Use

- **Intervals/ranges**
- Need to process in order
- Can sort first without losing information

### Problem Recognition

✅ "Merge intervals"
✅ "Meeting rooms"
✅ "Non-overlapping"

### Template

```javascript
// Merge Intervals pattern
intervals.sort((a, b) => a[0] - b[0]); // Sort by start
const merged = [intervals[0]];

for (let i = 1; i < intervals.length; i++) {
  const last = merged[merged.length - 1];
  const current = intervals[i];

  if (current[0] <= last[1]) {
    // Overlap - merge
    last[1] = Math.max(last[1], current[1]);
  } else {
    // No overlap - add new
    merged.push(current);
  }
}
```

### Your Problems

- ✅ Merge Intervals (#56) - 62.5% freq
- ✅ Median of Two Sorted Arrays (#4)
- ✅ Longest Consecutive Sequence (#128) - 50% freq

**Time**: O(N log N) for sort | **Space**: O(N)

---

## Pattern 6: Heap/Priority Queue 📍

### When to Use

- **Kth largest/smallest**
- Merge K sorted
- Top K elements
- Running median

### Problem Recognition

✅ "Kth largest"
✅ "Top K"
✅ "Smallest K"
✅ "Merge K sorted"

### Template (Min Heap)

```javascript
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return min;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent] <= this.heap[idx]) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _bubbleDown(idx) {
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;

      if (left < this.heap.length && this.heap[left] < this.heap[smallest]) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right] < this.heap[smallest]) {
        smallest = right;
      }
      if (smallest === idx) break;

      [this.heap[idx], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[idx],
      ];
      idx = smallest;
    }
  }
}

// Kth Largest Element
const minHeap = new MinHeap();
for (const num of nums) {
  minHeap.push(num);
  if (minHeap.size() > k) {
    minHeap.pop();
  }
}
return minHeap.peek();
```

### Your Problems

- ✅ Kth Largest Element (#215) - 50% freq
- ✅ Merge K Sorted Lists (#23) - 100% freq

**Time**: O(N log K) | **Space**: O(K)

---

## Pattern 7: Stack 📍

### When to Use

- **Matching pairs** (parentheses)
- **LIFO** operations
- Nested structures
- Valid sequences

### Problem Recognition

✅ "Valid parentheses"
✅ "Balanced brackets"
✅ "Nested structure"
✅ "Reverse Polish Notation"

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

### Your Problems

- ✅ Valid Parentheses (#20) - 75% freq

**Time**: O(N) | **Space**: O(N)

---

## Pattern 8: Binary Search 📍

### When to Use

- **Sorted array**
- Need **O(log N)** time
- Search/find insertion/boundaries

### Problem Recognition

✅ "Sorted array"
✅ "Find target"
✅ "O(log n) required"
✅ "Search insert position"

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

return -1; // or left for insertion point
```

### Your Problems

- ✅ Search Insert Position (#35)
- ✅ Sqrt(x) (#69)

**Time**: O(log N) | **Space**: O(1)

---

## Pattern 9: Greedy 📍

### When to Use

- **Optimization** problem
- **Local optimum** leads to global
- No need to reconsider previous choices

### Problem Recognition

✅ "Maximum profit"
✅ "Minimum steps"
✅ Can make best choice at each step

### Template

```javascript
// Best Time to Buy and Sell Stock
let minPrice = nums[0];
let maxProfit = 0;

for (let i = 1; i < nums.length; i++) {
  minPrice = Math.min(minPrice, nums[i]);
  maxProfit = Math.max(maxProfit, nums[i] - minPrice);
}
```

### Your Problems

- ✅ Best Time to Buy and Sell Stock (#121) - 75% freq

**Time**: O(N) | **Space**: O(1)

---

## Pattern 10: Backtracking ⚠️ (NOT in Deloitte list)

### When to Use

- **Generate all** combinations/permutations
- **Explore all paths**
- Decision tree problems

### Problem Recognition

✅ "All permutations"
✅ "All combinations"
✅ "All subsets"
✅ "N-Queens"
✅ "Word Search"

### Template

```javascript
function backtrack(path, options) {
  // Base case: found valid solution
  if (isComplete(path)) {
    result.push([...path]);
    return;
  }

  // Try each option
  for (const option of options) {
    // Make choice
    path.push(option);

    // Explore
    backtrack(path, nextOptions);

    // Undo choice (backtrack)
    path.pop();
  }
}
```

**Examples**: Permutations, Combinations, Subsets, N-Queens

**Time**: O(N!) for permutations, O(2^N) for subsets | **Space**: O(N)

---

## Pattern 11: Graph BFS/DFS ⚠️ (NOT in Deloitte list)

### When to Use

- **Graph traversal**
- **Shortest path** (BFS)
- **Connected components**
- Island problems

### Problem Recognition

✅ "Connected components"
✅ "Shortest path"
✅ "Number of islands"
✅ "Course prerequisites"

### BFS Template

```javascript
function bfs(start) {
  const queue = [start];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const node = queue.shift();

    // Process node
    for (const neighbor of graph[node]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}
```

### DFS Template

```javascript
function dfs(node, visited = new Set()) {
  if (visited.has(node)) return;

  visited.add(node);
  // Process node

  for (const neighbor of graph[node]) {
    dfs(neighbor, visited);
  }
}
```

**Examples**: Number of Islands, Clone Graph, Course Schedule

**Time**: O(V + E) | **Space**: O(V)

---

## Quick Reference: When to Use What

### If problem mentions...

- **"Pair that sums to X"** → Hash Map
- **"Sorted array"** → Two Pointers or Binary Search
- **"Substring with..."** → Sliding Window
- **"Maximum subarray"** → DP (Kadane's)
- **"How many ways"** → DP (Fibonacci/Knapsack)
- **"Merge intervals"** → Sorting
- **"Kth largest"** → Heap
- **"Valid parentheses"** → Stack
- **"All permutations"** → Backtracking
- **"Shortest path"** → Graph BFS

### If complexity required...

- **O(1) lookup** → Hash Map/Set
- **O(log N) search** → Binary Search
- **O(N) array traversal** → Two Pointers, Sliding Window
- **O(N log N)** → Sorting
- **O(N log K)** → Heap

---

## Coverage Summary

### ✅ Patterns You've Mastered (9)

1. Hash Map
2. Two Pointers
3. Sliding Window
4. Dynamic Programming
5. Sorting/Array
6. Heap
7. Stack
8. Binary Search
9. Greedy

### ⚠️ Important Patterns Not in Deloitte List (2)

10. Backtracking (common in FAANG)
11. Graph BFS/DFS (common in FAANG)

### 🚨 Critical Gap

- **SQL** - 18% of Deloitte problems

**For Deloitte**: You're **90% covered** on algorithms (need SQL)
**For all LeetCode**: You're **70% covered** (missing Backtracking, Graph)

---

## Study Plan

### Before Interview (High Priority)

1. **Practice SQL** (3 hours) - CRITICAL
2. Review all patterns in this doc (1 hour)
3. Practice 1 problem from each pattern (2 hours)

### After Interview (Nice to Have)

4. Learn Backtracking (advanced)
5. Learn Graph BFS/DFS (advanced)

**You're ready for Deloitte Round 1!** 🚀
