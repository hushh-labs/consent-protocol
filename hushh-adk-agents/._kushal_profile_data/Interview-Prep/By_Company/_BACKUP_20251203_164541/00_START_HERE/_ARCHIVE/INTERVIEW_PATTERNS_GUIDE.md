# Deloitte Interview Patterns Guide

**Your Complete Pattern Reference for Round 1-3**

---

## How to Use This Guide

1. **Before Interview**: Review all ✅ patterns - you've practiced these
2. **During Prep**: Focus on ⚠️ gaps - these are critical for Deloitte
3. **Interview Day**: Keep this open as quick reference for pattern recognition

---

## Pattern Coverage Status

### ✅ Mastered (You've Practiced)

- Hash Map / Frequency Counting
- Two Pointers
- Stack
- Greedy / One Pass Optimization
- Bit Manipulation
- Divide & Conquer
- Expand Around Center

### ⚠️ Critical Gaps (Must Practice)

- **SQL Queries** (20% of Deloitte problems!)
- Sliding Window
- Binary Search
- DFS/BFS (Tree/Graph Traversal)

### 📚 Optional (Nice to Have)

- Dynamic Programming (Knapsack, LCS)
- Backtracking
- Union Find

---

## Round 1: Technical Coding (What to Expect)

**Format**: 2-3 problems in 60-90 minutes

**Difficulty Mix**:

- 1 Easy (15-20 min)
- 1-2 Medium (30-45 min each)
- **20% chance of SQL problem**

**Pattern Distribution** (based on Deloitte verified data):

1. Arrays (35%) - Hash Map, Two Pointers, Sliding Window
2. Strings (20%) - Hash Map, Two Pointers, Stack
3. Linked Lists (15%) - Two Pointers, Divide & Conquer
4. SQL (20%) ⚠️ - Window Functions, Joins, Aggregation
5. Dynamic Programming (15%)
6. Trees (10%)

---

## Pattern 1: Hash Map / Frequency Counting

### When to Recognize

- "Find duplicates"
- "Count occurrences"
- "Find pairs that sum to X"
- "Group by property"
- **Time**: O(N), **Space**: O(N)

### Problems You've Solved ✅

1. Two Sum (#1) - _87.5% Deloitte frequency_
2. First Unique Character (#387) - _75% frequency_

### Template (Your Solution)

```javascript
const map = new Map();
for (let i = 0; i < arr.length; i++) {
  if (!map.has(arr[i])) {
    map.set(arr[i], { index: i, count: 1 });
  } else {
    let obj = map.get(arr[i]);
    obj.count++;
  }
}
```

### Deloitte Favorites You Should Practice

- Group Anagrams (#49) - 50% frequency
- Longest Consecutive Sequence (#128) - 50% frequency

---

## Pattern 2: Two Pointers

### When to Recognize

- "Sorted array"
- "Palindrome"
- "In-place operation"
- "Find pair with property"
- **Time**: O(N), **Space**: O(1)

### Problems You've Solved ✅

1. Container With Most Water (#11) - _75% Deloitte frequency_
2. Valid Parentheses (#20) - _75% frequency_ (uses Stack, similar concept)

### Template

```javascript
let left = 0;
let right = arr.length - 1;

while (left < right) {
  if (condition) {
    left++;
  } else {
    right--;
  }
}
```

### Key Insight You Learned

**Move the shorter/smaller element** - The element that's limiting the result should be the one to move.

### Deloitte Favorites You Should Practice

- 3Sum (#15) - 50% frequency
- Valid Palindrome (#125)

---

## Pattern 3: Stack

### When to Recognize

- "Matching pairs"
- "Valid parentheses"
- "Nested structure"
- **Time**: O(N), **Space**: O(N)

### Problems You've Solved ✅

1. Valid Parentheses (#20) - _75% Deloitte frequency_

### Template

```javascript
const stack = [];
for (let char of s) {
  if (isOpening(char)) {
    stack.push(char);
  } else {
    if (stack.length === 0 || !matches(stack.pop(), char)) {
      return false;
    }
  }
}
return stack.length === 0;
```

---

## Pattern 4: Greedy / One Pass Optimization

### When to Recognize

- "Maximize/minimize with single pass"
- "Track best so far"
- "No need to check all combinations"
- **Time**: O(N), **Space**: O(1)

### Problems You've Solved ✅

1. Best Time to Buy and Sell Stock (#121) - _75% Deloitte frequency_

### Template (Your Lesson)

```javascript
let best = Infinity; // or -Infinity for max
let result = 0;

for (let i = 0; i < arr.length; i++) {
  best = Math.min(best, arr[i]); // Track best so far
  result = Math.max(result, arr[i] - best); // Update result
}
```

### Key Insight You Learned

You only need to track the **best choice in the past**, not the exact index.

---

## Pattern 5: Bit Manipulation

### When to Recognize

- "Count set bits"
- "Power of 2"
- "Single number"
- "XOR properties"
- **Time**: O(N), **Space**: O(1)

### Problems You've Solved ✅

1. Counting Bits (#338)

### Template

```javascript
// Right shift to divide by 2, AND to get last bit
ans[i] = ans[i >> 1] + (i & 1);
```

### Key Operations

- `i >> 1` = `Math.floor(i / 2)`
- `i & 1` = `i % 2`
- `i & (i - 1)` = Remove rightmost set bit

---

## Pattern 6: Divide & Conquer

### When to Recognize

- "Can I solve half?"
- "Merge sorted results"
- "Logarithmic time"
- **Time**: O(N log k), **Space**: O(log k) for recursion

### Problems You've Solved ✅

1. Merge k Sorted Lists (#23) - _100% Deloitte frequency_ ⭐ CRITICAL

### Template

```javascript
while (interval < lists.length) {
  for (let i = 0; i + interval < lists.length; i += interval * 2) {
    lists[i] = merge(lists[i], lists[i + interval]);
  }
  interval *= 2;
}
```

### Key Insight You Learned

Think of it like a **knockout tournament** - pairs reduce by half each round. That's why it's O(log k).

---

## Pattern 7: Expand Around Center

### When to Recognize

- "Palindrome"
- "Symmetric structure"
- **Time**: O(N²), **Space**: O(1)

### Problems You've Solved ✅

1. Longest Palindromic Substring (#5) - _87.5% Deloitte frequency_ ⭐ CRITICAL

### Template

```javascript
for (let i = 0; i < s.length; i++) {
  let len1 = expand(s, i, i); // Odd length
  let len2 = expand(s, i, i + 1); // Even length
  let len = Math.max(len1, len2);
  // Update result
}

function expand(s, left, right) {
  while (left >= 0 && right < s.length && s[left] === s[right]) {
    left--;
    right++;
  }
  return right - left - 1;
}
```

---

## Pattern 8: Sliding Window ⚠️ GAP

### When to Recognize

- "Substring/subarray with property"
- "Longest/shortest with condition"
- **Time**: O(N), **Space**: O(k)

### Critical Deloitte Problem

- Longest Substring Without Repeating Characters (#3) - _50% frequency_

### Template (Study This)

```javascript
let left = 0;
let maxLen = 0;
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

---

## Pattern 9: Binary Search ⚠️ GAP

### When to Recognize

- "Sorted array"
- "O(log N) required"
- "Find target/insert position"
- **Time**: O(log N), **Space**: O(1)

### Template (Memorize This)

```javascript
let left = 0;
let right = arr.length - 1;

while (left <= right) {
  let mid = Math.floor((left + right) / 2);

  if (arr[mid] === target) return mid;
  if (arr[mid] < target) {
    left = mid + 1;
  } else {
    right = mid - 1;
  }
}
return -1; // or return left for insert position
```

---

## Pattern 10: SQL ⚠️ CRITICAL GAP

### When to Recognize

Deloitte asks SQL in 20% of Round 1 interviews. You **must** practice this.

### Critical Problems (From Verified List)

1. **Second Highest Salary** (#176) - 75% frequency
2. **Change Null Values** (#2388) - 87.5% frequency
3. **Managers with 5+ Reports** (#570) - 75% frequency

### Essential SQL Concepts

```sql
-- Window Functions (LAG for previous row)
SELECT id, COALESCE(amount, LAG(amount) OVER (ORDER BY id)) AS amount
FROM Transactions;

-- Aggregation with HAVING
SELECT managerId, COUNT(*) as count
FROM Employee
GROUP BY managerId
HAVING COUNT(*) >= 5;

-- Self Join for date comparison
SELECT w1.id
FROM Weather w1
JOIN Weather w2 ON DATEDIFF(w1.date, w2.date) = 1
WHERE w1.temp > w2.temp;
```

---

## Pattern 11: DFS/BFS (Trees) ⚠️ GAP

### When to Recognize

- "Tree traversal"
- "Level order"
- "Find path"
- **Time**: O(N), **Space**: O(H) for DFS, O(W) for BFS

### You Have Some Practice

- Subtree of Another Tree (#14)
- Construct Binary Tree

### Template (DFS)

```javascript
function dfs(node) {
  if (!node) return;

  // Preorder: Process node first
  dfs(node.left);
  dfs(node.right);
}
```

---

## Interview Day Strategy

### First 2 Minutes (Pattern Recognition)

Ask yourself:

1. Is the input **sorted**? → Two Pointers or Binary Search
2. Is it about **counting/frequency**? → Hash Map
3. Is it about **matching/nesting**? → Stack
4. Is it about **substring/subarray**? → Sliding Window
5. Is it **SQL**? → Window Functions, Joins, Aggregation

### Code Template Checklist

Before you start coding:

- [ ] What's the pattern?
- [ ] What's the time/space complexity?
- [ ] Edge cases (empty input, single element)?
- [ ] Can I explain the approach in 30 seconds?

### Time Management (90 min total)

- **Easy (15 min)**: 5 min think + 8 min code + 2 min test
- **Medium (35 min)**: 5 min think + 20 min code + 10 min test
- **Leave 10 min buffer** for debugging

---

## Your Strong Patterns (Interview Confidence Boosters)

These are patterns where you've demonstrated **natural optimization thinking**:

1. ✅ **First Unique Character** - You naturally optimized to iterate over map (26 keys) instead of string (N chars)
2. ✅ **Two Pointers** - You understood the "move the shorter line" greedy choice
3. ✅ **Divide & Conquer** - You grasped the O(N log k) knockout tournament analogy

**This shows**: You don't just memorize - you **think about efficiency**. Lean into this during the interview!

---

## Final Prep Checklist (Before Dec 4)

### Must Practice (Next 2-3 Days)

- [ ] 3 SQL problems (Second Highest Salary, Window Functions, Self Join)
- [ ] Longest Substring Without Repeating (Sliding Window)
- [ ] Binary Search Template (15 min practice)
- [ ] Tree Traversal (DFS/BFS review)

### Already Strong (Quick Review)

- [x] Hash Map - First Unique Character
- [x] Two Pointers - Container With Most Water
- [x] Stack - Valid Parentheses
- [x] Greedy - Best Time to Buy and Sell Stock

### Day Before Interview

- [ ] Review this guide (15 min)
- [ ] Practice 1 easy problem to warm up
- [ ] Review time complexity cheat sheet

---

## Quick Reference: Time Complexity

| Operation        | Time       | Pattern               |
| :--------------- | :--------- | :-------------------- |
| Hash Map lookup  | O(1)       | Two Sum, Frequency    |
| Two Pointers     | O(N)       | Container, Palindrome |
| Sliding Window   | O(N)       | Longest Substring     |
| Binary Search    | O(log N)   | Sorted Array          |
| DFS/BFS          | O(N)       | Tree/Graph            |
| Divide & Conquer | O(N log k) | Merge k Lists         |

Good luck! You've got this! 🚀
