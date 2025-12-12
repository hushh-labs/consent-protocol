# Deloitte Round 1 Focus

**Critical information for Technical Coding Assessment**

Based on Deloitte interview requirements and verified problems.

---

## Round 1 Overview

**Objective**: Assess foundational coding skills and proficiency in core technologies (C#, .NET, Azure, ReactJS)

**Format**:

- 2-3 coding problems
- 60-90 minutes total
- C# preferred (primary language)
- May include system design basics

**Focus Areas**:

- Algorithm and data structure problems
- Clean, maintainable, testable code
- Time/space complexity analysis
- C#/.NET best practices

---

## Most Common Problem Types

### Distribution (Based on Verified Data)

- **Arrays**: ~35% of problems
- **Strings**: ~20% of problems
- **Linked Lists**: ~15% of problems
- **SQL/Database**: ~20% of problems ⚠️ IMPORTANT
- **Dynamic Programming**: ~15% of problems
- **Trees**: ~10% of problems
- **Other**: ~5% of problems

**Note**: Deloitte frequently asks SQL problems! Be prepared for database queries.

### Difficulty Distribution (Based on Verified Data)

- **Easy**: ~45% of problems
- **Medium**: ~50% of problems
- **Hard**: ~5% of problems (e.g., Merge k Sorted Lists, Reverse Pairs)

---

## Complete Verified Deloitte Interview Problems (GitHub Data)

**Source**: [LeetCode Companywise Interview Questions - Deloitte (All Problems)](https://github.com/snehasishroy/leetcode-companywise-interview-questions/blob/master/deloitte/all.csv)

**Data**: Complete list of all problems asked in Deloitte interviews

### Summary Statistics

- **Total Problems**: 33 problems
- **100% Frequency**: 1 problem (Merge k Sorted Lists)
- **87.5% Frequency**: 2 problems (Two Sum, Change Null Values)
- **75% Frequency**: 8 problems (Valid Parentheses, Palindrome Number, etc.)
- **62.5% Frequency**: 6 problems (Reverse Integer, Merge Intervals, etc.)
- **50% Frequency**: 16 problems (Standard frequency)

### Problem Type Breakdown

- **Algorithm Problems**: 27 problems (82%)
- **SQL Problems**: 6 problems (18%)
  - Second Highest Salary (#176) - 75%
  - Change Null Values (#2388) - 87.5% ⭐
  - Managers with Direct Reports (#570) - 75%
  - Rising Temperature (#197) - 62.5%
  - Customers Who Never Order (#183) - 62.5%
  - Nth Highest Salary (#177) - 50%

### Difficulty Breakdown

- **Easy**: 15 problems (45%)
- **Medium**: 16 problems (48%)
- **Hard**: 2 problems (6%)

### Highest Frequency (100% - 87.5%)

**1. Merge k Sorted Lists (#23)** - Hard - 100% Frequency ⭐ CRITICAL

- **URL**: https://leetcode.com/problems/merge-k-sorted-lists
- **Acceptance**: 58.2%
- **Pattern**: Divide and Conquer, Priority Queue, Linked Lists
- **Why**: Tests advanced linked list manipulation and optimization

**2. Two Sum (#1)** - Easy - 87.5% Frequency ⭐ CRITICAL

- **URL**: https://leetcode.com/problems/two-sum
- **Acceptance**: 56.6%
- **Pattern**: Hash Map (Dictionary)
- **Why**: Most fundamental problem, tests hash map understanding

**3. Longest Palindromic Substring (#5)** - Medium - 87.5% Frequency ⭐ CRITICAL

- **URL**: https://leetcode.com/problems/longest-palindromic-substring
- **Acceptance**: 36.8%
- **Pattern**: Two Pointers, Dynamic Programming, Expand Around Centers
- **Why**: Tests string manipulation and palindrome detection

**4. Change Null Values in a Table to the Previous Value (#2388)** - Medium - 87.5% Frequency ⭐ CRITICAL

- **URL**: https://leetcode.com/problems/change-null-values-in-a-table-to-the-previous-value
- **Acceptance**: 51.3%
- **Pattern**: SQL Query, Window Functions (LAG)
- **Why**: SQL problem, tests window functions

**5. Second Highest Salary (#176)** - Medium - 75% Frequency ⭐ CRITICAL

- **URL**: https://leetcode.com/problems/second-highest-salary
- **Acceptance**: 45.5%
- **Pattern**: SQL Query, Window Functions
- **Why**: SQL problem, tests database query skills

### High Frequency (75% - 62.5%)

**5. Valid Parentheses (#20)** - Easy - 75% Frequency ⭐ CRITICAL

- **URL**: https://leetcode.com/problems/valid-parentheses
- **Acceptance**: 43.2%
- **Pattern**: Stack
- **Why**: Tests stack understanding, matching problems

**6. Reverse Integer (#7)** - Medium - 75% Frequency

- **URL**: https://leetcode.com/problems/reverse-integer
- **Acceptance**: 31.1%
- **Pattern**: Math, Overflow Handling
- **Why**: Tests integer manipulation and edge cases

**7. Palindrome Number (#9)** - Easy - 75% Frequency

- **URL**: https://leetcode.com/problems/palindrome-number
- **Acceptance**: 59.9%
- **Pattern**: Math, Two Pointers
- **Why**: Tests number manipulation and palindrome logic

**8. Container With Most Water (#11)** - Medium - 75% Frequency

- **URL**: https://leetcode.com/problems/container-with-most-water
- **Acceptance**: 59.0%
- **Pattern**: Two Pointers, Greedy
- **Why**: Tests two-pointer technique and optimization

**9. Managers with at Least 5 Direct Reports (#570)** - Medium - 75% Frequency

- **URL**: https://leetcode.com/problems/managers-with-at-least-5-direct-reports
- **Acceptance**: 48.9%
- **Pattern**: SQL Query, GROUP BY, HAVING
- **Why**: SQL problem, tests aggregation and filtering

**10. First Unique Character in a String (#387)** - Easy - 75% Frequency

- **URL**: https://leetcode.com/problems/first-unique-character-in-a-string
- **Acceptance**: 64.5%
- **Pattern**: Hash Map, String Traversal
- **Why**: Tests hash map usage for frequency counting

**11. Best Time to Buy and Sell Stock (#121)** - Easy - 75% Frequency

- **URL**: https://leetcode.com/problems/best-time-to-buy-and-sell-stock
- **Acceptance**: 56.0%
- **Pattern**: Dynamic Programming, Greedy
- **Why**: Tests optimization and DP thinking

**12. Reverse Integer (#7)** - Medium - 62.5% Frequency

- **URL**: https://leetcode.com/problems/reverse-integer
- **Acceptance**: 31.1%
- **Pattern**: Math, Overflow Handling
- **Why**: Tests integer manipulation and edge cases

**13. Rising Temperature (#197)** - Easy - 62.5% Frequency

- **URL**: https://leetcode.com/problems/rising-temperature
- **Acceptance**: 50.8%
- **Pattern**: SQL Query, Self Join, Date Comparison
- **Why**: SQL problem, tests date operations

**14. Merge Intervals (#56)** - Medium - 62.5% Frequency

- **URL**: https://leetcode.com/problems/merge-intervals
- **Acceptance**: 50.5%
- **Pattern**: Sorting, Two Pointers
- **Why**: Tests interval manipulation and sorting

**15. Maximum Subarray (#53)** - Medium - 62.5% Frequency

- **URL**: https://leetcode.com/problems/maximum-subarray
- **Acceptance**: 52.7%
- **Pattern**: Dynamic Programming (Kadane's Algorithm), Greedy
- **Why**: Tests DP pattern and optimization

**16. Customers Who Never Order (#183)** - Easy - 62.5% Frequency

- **URL**: https://leetcode.com/problems/customers-who-never-order
- **Acceptance**: 71.2%
- **Pattern**: SQL Query, LEFT JOIN, NULL check
- **Why**: SQL problem, tests join operations

**17. Reverse Linked List (#206)** - Easy - 50% Frequency

- **URL**: https://leetcode.com/problems/reverse-linked-list
- **Acceptance**: 79.9%
- **Pattern**: Linked List manipulation
- **Why**: Tests pointer manipulation, fundamental data structure

### Medium Frequency (50% - Standard)

**18. Climbing Stairs (#70)** - Easy - 50% Frequency

- **URL**: https://leetcode.com/problems/climbing-stairs
- **Acceptance**: 53.8%
- **Pattern**: Dynamic Programming (Fibonacci variant)
- **Why**: Tests dynamic programming understanding

**19. Majority Element (#169)** - Easy - 50% Frequency

- **URL**: https://leetcode.com/problems/majority-element
- **Acceptance**: 66.0%
- **Pattern**: Hash Map, Boyer-Moore Voting Algorithm
- **Why**: Tests frequency counting and optimization

**20. Longest Common Prefix (#14)** - Easy - 50% Frequency

- **URL**: https://leetcode.com/problems/longest-common-prefix
- **Acceptance**: 46.5%
- **Pattern**: String Manipulation, Trie (optional)
- **Why**: Tests string comparison and optimization

**21. Edit Distance (#72)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/edit-distance
- **Acceptance**: 59.7%
- **Pattern**: Dynamic Programming, String Manipulation
- **Why**: Tests DP with string operations

**22. Minimum Time to Repair Cars (#2594)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/minimum-time-to-repair-cars
- **Acceptance**: 59.7%
- **Pattern**: Binary Search, Greedy
- **Why**: Tests binary search on answer pattern

**23. Coin Change (#322)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/coin-change
- **Acceptance**: 47.5%
- **Pattern**: Dynamic Programming (Unbounded Knapsack)
- **Why**: Tests DP pattern recognition

**24. Max Consecutive Ones (#485)** - Easy - 50% Frequency

- **URL**: https://leetcode.com/problems/max-consecutive-ones
- **Acceptance**: 63.7%
- **Pattern**: Two Pointers, Sliding Window
- **Why**: Tests array traversal and counting

**25. Kth Largest Element in an Array (#215)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/kth-largest-element-in-an-array
- **Acceptance**: 68.6%
- **Pattern**: Quick Select, Heap (Priority Queue), Sorting
- **Why**: Tests selection algorithm and optimization

**26. Longest Substring Without Repeating Characters (#3)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/longest-substring-without-repeating-characters
- **Acceptance**: 37.9%
- **Pattern**: Sliding Window, Hash Set
- **Why**: Tests sliding window pattern

**27. Roman to Integer (#13)** - Easy - 50% Frequency

- **URL**: https://leetcode.com/problems/roman-to-integer
- **Acceptance**: 65.8%
- **Pattern**: Hash Map, String Processing
- **Why**: Tests string parsing and mapping

**28. Nth Highest Salary (#177)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/nth-highest-salary
- **Acceptance**: 38.6%
- **Pattern**: SQL Query, Window Functions, Subquery
- **Why**: SQL problem, tests window functions

**29. Reverse Pairs (#493)** - Hard - 50% Frequency

- **URL**: https://leetcode.com/problems/reverse-pairs
- **Acceptance**: 33.2%
- **Pattern**: Merge Sort, Divide and Conquer
- **Why**: Tests advanced array manipulation

**30. Group Anagrams (#49)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/group-anagrams
- **Acceptance**: 71.7%
- **Pattern**: Hash Map, String Sorting
- **Why**: Tests hash map for grouping

**31. Longest Consecutive Sequence (#128)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/longest-consecutive-sequence
- **Acceptance**: 47.0%
- **Pattern**: Hash Set, Union Find
- **Why**: Tests hash set optimization

**32. Remove K-Balanced Substrings (#3703)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/remove-k-balanced-substrings
- **Acceptance**: 31.9%
- **Pattern**: Greedy, String Manipulation
- **Why**: Tests string processing and greedy approach

**33. 3Sum (#15)** - Medium - 50% Frequency

- **URL**: https://leetcode.com/problems/3sum
- **Acceptance**: 38.0%
- **Pattern**: Two Pointers, Sorting
- **Why**: Tests two-pointer technique with sorting

---

## Must-Know Problems (Deloitte Favorites)

These problems appear frequently in Deloitte interviews (from verified data + common patterns):

### 1. Two Sum (#1) - Easy ⭐ CRITICAL

**Why**: Tests hash map understanding, fundamental problem-solving

**Pattern**: Hash Map (Dictionary)

**C# Solution**:

```csharp
public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        var indexMap = new Dictionary<int, int>();

        for (int i = 0; i < nums.Length; i++) {
            int complement = target - nums[i];
            if (indexMap.ContainsKey(complement)) {
                return new[] { indexMap[complement], i };
            }
            indexMap[nums[i]] = i;
        }

        return new int[0];
    }
}
```

**Time**: O(n), **Space**: O(n)

**Practice**: Solve 3x, know it by heart

---

### 2. Valid Parentheses (#20) - Easy ⭐ CRITICAL

**Why**: Tests stack understanding, matching problems

**Pattern**: Stack

**C# Solution**:

```csharp
public class Solution {
    public bool IsValid(string s) {
        var stack = new Stack<char>();

        foreach (char c in s) {
            if (c == '(' || c == '[' || c == '{') {
                stack.Push(c);
            } else {
                if (stack.Count == 0) return false;
                char top = stack.Pop();
                if (!IsMatching(top, c)) return false;
            }
        }

        return stack.Count == 0;
    }

    private bool IsMatching(char open, char close) {
        return (open == '(' && close == ')') ||
               (open == '[' && close == ']') ||
               (open == '{' && close == '}');
    }
}
```

**Time**: O(n), **Space**: O(n)

**Practice**: Solve 3x, understand stack operations

---

### 3. Reverse Linked List (#206) - Easy ⭐ CRITICAL

**Why**: Tests pointer manipulation, fundamental data structure

**Pattern**: Linked List manipulation

**C# Solution (Iterative)**:

```csharp
public class Solution {
    public ListNode ReverseList(ListNode head) {
        ListNode prev = null;
        ListNode curr = head;

        while (curr != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }

        return prev;
    }
}
```

**C# Solution (Recursive)**:

```csharp
public class Solution {
    public ListNode ReverseList(ListNode head) {
        if (head == null || head.next == null) {
            return head;
        }

        ListNode newHead = ReverseList(head.next);
        head.next.next = head;
        head.next = null;

        return newHead;
    }
}
```

**Time**: O(n), **Space**: O(1) iterative, O(n) recursive

**Practice**: Know both iterative and recursive solutions

---

### 4. Binary Search (#704) - Easy ⭐ CRITICAL

**Why**: Tests understanding of search efficiency, fundamental algorithm

**Pattern**: Binary Search

**C# Solution**:

```csharp
public class Solution {
    public int Search(int[] nums, int target) {
        int left = 0;
        int right = nums.Length - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2; // Prevents overflow

            if (nums[mid] == target) {
                return mid;
            } else if (nums[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return -1;
    }
}
```

**Time**: O(log n), **Space**: O(1)

**Practice**: Memorize template, understand overflow prevention

---

### 5. Longest Substring Without Repeating Characters (#3) - Medium ⭐ CRITICAL

**Why**: Tests sliding window pattern, hash set usage

**Pattern**: Sliding Window + HashSet

**C# Solution**:

```csharp
public class Solution {
    public int LengthOfLongestSubstring(string s) {
        var charSet = new HashSet<char>();
        int left = 0;
        int maxLength = 0;

        for (int right = 0; right < s.Length; right++) {
            while (charSet.Contains(s[right])) {
                charSet.Remove(s[left]);
                left++;
            }
            charSet.Add(s[right]);
            maxLength = Math.Max(maxLength, right - left + 1);
        }

        return maxLength;
    }
}
```

**Time**: O(n), **Space**: O(min(m, n)) where m is charset size

**Practice**: Understand sliding window pattern

---

### 6. Climbing Stairs (#70) - Easy ⭐ CRITICAL

**Why**: Tests dynamic programming understanding

**Pattern**: Dynamic Programming (Fibonacci variant)

**C# Solution**:

```csharp
public class Solution {
    public int ClimbStairs(int n) {
        if (n <= 2) return n;

        int prev2 = 1;
        int prev1 = 2;

        for (int i = 3; i <= n; i++) {
            int curr = prev1 + prev2;
            prev2 = prev1;
            prev1 = curr;
        }

        return prev1;
    }
}
```

**Time**: O(n), **Space**: O(1)

**Practice**: Understand DP pattern, space optimization

---

## SQL Problems Preparation ⚠️ CRITICAL

**20% of Deloitte problems are SQL!** Be prepared for database queries.

### Common SQL Patterns in Deloitte Interviews

**1. Second Highest Salary (#176)** - 87.5% Frequency

```sql
-- Using subquery
SELECT MAX(salary) AS SecondHighestSalary
FROM Employee
WHERE salary < (SELECT MAX(salary) FROM Employee);

-- Using LIMIT/OFFSET
SELECT DISTINCT salary AS SecondHighestSalary
FROM Employee
ORDER BY salary DESC
LIMIT 1 OFFSET 1;
```

**2. Managers with at Least 5 Direct Reports (#570)** - 75% Frequency

```sql
SELECT e1.name
FROM Employee e1
INNER JOIN Employee e2 ON e1.id = e2.managerId
GROUP BY e1.id, e1.name
HAVING COUNT(e2.id) >= 5;
```

**3. Rising Temperature (#197)** - 62.5% Frequency

```sql
SELECT w1.id
FROM Weather w1
JOIN Weather w2 ON DATEDIFF(w1.recordDate, w2.recordDate) = 1
WHERE w1.temperature > w2.temperature;
```

**4. Change Null Values (#2388)** - 62.5% Frequency

```sql
SELECT id,
       COALESCE(amount, LAG(amount) OVER (ORDER BY id)) AS amount
FROM Transactions
ORDER BY id;
```

### SQL Concepts to Master

- **Window Functions**: LAG, LEAD, ROW_NUMBER, RANK, DENSE_RANK
- **Aggregation**: GROUP BY, HAVING, COUNT, MAX, MIN, SUM, AVG
- **Joins**: INNER JOIN, LEFT JOIN, RIGHT JOIN, SELF JOIN
- **Subqueries**: Correlated and non-correlated
- **Date Functions**: DATEDIFF, DATEADD, YEAR, MONTH, DAY
- **NULL Handling**: COALESCE, ISNULL, NULLIF

### Practice SQL Problems (From Verified List)

1. **Second Highest Salary (#176)** - 75% Frequency ⭐ CRITICAL
2. **Change Null Values in a Table to the Previous Value (#2388)** - 87.5% Frequency ⭐ CRITICAL
3. **Managers with at Least 5 Direct Reports (#570)** - 75% Frequency
4. **Rising Temperature (#197)** - 62.5% Frequency
5. **Customers Who Never Order (#183)** - 62.5% Frequency
6. **Nth Highest Salary (#177)** - 50% Frequency

---

## C#/.NET Best Practices

### 1. Use LINQ Appropriately

**Good**:

```csharp
// Filtering
var evens = nums.Where(x => x % 2 == 0).ToList();

// Sorting
var sorted = nums.OrderBy(x => x).ToArray();

// Aggregation
int sum = nums.Sum();
```

**Avoid**:

```csharp
// Don't use LINQ for simple operations that are clearer with loops
// Don't chain too many LINQ operations (readability)
```

---

### 2. Dictionary Operations

**Good**:

```csharp
// Use TryGetValue instead of ContainsKey + indexer
if (dict.TryGetValue(key, out int value)) {
    // Use value
}

// Use GetValueOrDefault for frequency counting
freq[num] = freq.GetValueOrDefault(num, 0) + 1;
```

**Avoid**:

```csharp
// Don't check ContainsKey then access (two lookups)
if (dict.ContainsKey(key)) {
    int value = dict[key]; // Second lookup
}
```

---

### 3. String Operations

**Good**:

```csharp
// Use StringBuilder for many concatenations
var sb = new StringBuilder();
for (int i = 0; i < n; i++) {
    sb.Append(i);
}
string result = sb.ToString();

// Use char[] for in-place string manipulation
char[] chars = s.ToCharArray();
// Modify chars
string result = new string(chars);
```

**Avoid**:

```csharp
// Don't concatenate strings in loops (creates many new strings)
string result = "";
for (int i = 0; i < n; i++) {
    result += i; // Creates new string each time
}
```

---

### 4. Array vs List

**Use Array** when:

- Fixed size known at creation
- Performance critical
- Simple data storage

**Use List** when:

- Dynamic size needed
- Need Add/Remove operations
- Working with LINQ

---

### 5. Null Safety

**Always check**:

```csharp
if (nums == null || nums.Length == 0) {
    return defaultValue;
}

if (node == null) {
    return;
}
```

---

## Coding Standards

### 1. Clean Code

- **Meaningful variable names**: `indexMap` not `dict`, `maxLength` not `max`
- **Comments for complex logic**: Explain why, not what
- **Consistent formatting**: Follow C# conventions
- **Small functions**: Single responsibility

### 2. Testable Code

- **Clear input/output**: Well-defined method signatures
- **No side effects**: Don't modify inputs unless required
- **Edge case handling**: Check for null, empty, single element

### 3. Maintainable Code

- **Use patterns**: Don't reinvent the wheel
- **DRY principle**: Don't repeat yourself
- **Readable**: Code should be self-documenting

---

## Time Management

### Target Times

- **Easy Problems**: 15-20 minutes

  - Read & Understand: 2 min
  - Identify Pattern: 2 min
  - Code: 8-10 min
  - Test: 3-5 min

- **Medium Problems**: 30-45 minutes
  - Read & Understand: 3 min
  - Identify Pattern: 3 min
  - Code: 15-20 min
  - Test: 5-7 min

### If Stuck

1. **After 5 minutes**: Re-read problem, check understanding
2. **After 10 minutes**: Think of brute force solution
3. **After 15 minutes**: Ask for hint (if allowed)
4. **After 20 minutes**: Move to next problem, come back later

---

## What to Expect

### Problem Types

1. **Algorithm Problems** (80%)

   - Arrays, strings, linked lists, trees
   - Focus on patterns from CORE_ALGORITHM_PATTERNS.md

2. **Data Structure Problems** (15%)

   - Implement data structure (Stack, Queue, etc.)
   - Use data structure to solve problem

3. **System Design Basics** (5%)
   - High-level architecture
   - Scalability considerations
   - Integration patterns

### Interview Format

1. **Problem Presentation** (5 min)

   - Interviewer presents problem
   - You can ask clarifying questions

2. **Solution Discussion** (5-10 min)

   - Discuss approach
   - Explain time/space complexity
   - May ask for optimization

3. **Coding** (20-40 min)

   - Write code in C#
   - Explain as you code
   - Handle edge cases

4. **Testing** (5-10 min)
   - Walk through examples
   - Test edge cases
   - Discuss optimizations

---

## Common Questions to Ask

### Clarifying Questions

1. **Input validation**

   - "Can the array be empty?"
   - "Are there duplicates?"
   - "What's the range of values?"

2. **Output format**

   - "What should I return if no solution?"
   - "Should I return indices or values?"

3. **Constraints**
   - "What's the maximum array size?"
   - "Are there any time/space constraints?"

---

## Red Flags to Avoid

1. **Jumping to code**: Always discuss approach first
2. **No edge case handling**: Always check for null, empty, single element
3. **Poor variable names**: Use descriptive names
4. **No complexity analysis**: Always state time/space complexity
5. **Not testing**: Always test with examples before submitting
6. **Giving up too early**: Show problem-solving process even if stuck

---

## Success Checklist

Before the interview, ensure you can:

### Algorithm Problems (C#) - Priority Order

**Highest Priority (100% - 87.5% Frequency):**

- [ ] Solve Merge k Sorted Lists (#23) - 100% frequency ⭐ CRITICAL
- [ ] Solve Two Sum (#1) in 15 minutes - 87.5% frequency ⭐ CRITICAL
- [ ] Solve Longest Palindromic Substring (#5) in 30 minutes - 87.5% frequency ⭐ CRITICAL

**High Priority (75% Frequency):**

- [ ] Solve Valid Parentheses (#20) in 15 minutes - 75% frequency ⭐
- [ ] Solve Palindrome Number (#9) in 15 minutes - 75% frequency
- [ ] Solve Container With Most Water (#11) in 25 minutes - 75% frequency
- [ ] Solve Best Time to Buy and Sell Stock (#121) in 20 minutes - 75% frequency
- [ ] Solve First Unique Character in a String (#387) in 15 minutes - 75% frequency

**Medium Priority (62.5% Frequency):**

- [ ] Solve Reverse Integer (#7) in 20 minutes - 62.5% frequency
- [ ] Solve Merge Intervals (#56) in 25 minutes - 62.5% frequency
- [ ] Solve Maximum Subarray (#53) in 20 minutes - 62.5% frequency

**Standard Priority (50% Frequency):**

- [ ] Solve Climbing Stairs (#70) in 20 minutes - 50% frequency
- [ ] Solve Coin Change (#322) in 30 minutes - 50% frequency
- [ ] Solve Longest Substring Without Repeating Characters (#3) in 25 minutes - 50% frequency
- [ ] Solve 3Sum (#15) in 30 minutes - 50% frequency
- [ ] Solve Kth Largest Element (#215) in 25 minutes - 50% frequency

### SQL Problems - Priority Order

**Highest Priority:**

- [ ] Solve Change Null Values (#2388) - 87.5% frequency ⭐ CRITICAL
- [ ] Solve Second Highest Salary (#176) - 75% frequency ⭐ CRITICAL

**High Priority:**

- [ ] Solve Managers with at Least 5 Direct Reports (#570) - 75% frequency
- [ ] Solve Rising Temperature (#197) - 62.5% frequency
- [ ] Solve Customers Who Never Order (#183) - 62.5% frequency
- [ ] Solve Nth Highest Salary (#177) - 50% frequency

**SQL Concepts:**

- [ ] Master Window Functions (LAG, LEAD, ROW_NUMBER, RANK)
- [ ] Master JOIN operations (INNER, LEFT, SELF JOIN)
- [ ] Master GROUP BY and HAVING
- [ ] Master Date functions (DATEDIFF, DATEADD)

### Hard Problems (If Time Permits)

- [ ] Understand Merge k Sorted Lists (#23) - 100% frequency ⭐ (Already listed above)
- [ ] Understand Reverse Pairs (#493) - 50% frequency

### General Skills

- [ ] Explain time/space complexity clearly
- [ ] Write clean, readable C# code
- [ ] Use LINQ appropriately
- [ ] Handle edge cases (null, empty, single element)
- [ ] Test solutions before submitting
- [ ] Write SQL queries efficiently

---

## Final Tips

1. **Practice Daily**: Consistency is key
2. **Focus on Patterns**: Don't memorize solutions
3. **C# First**: Always solve in C# (Deloitte's primary language)
4. **Time Yourself**: Speed matters in interviews
5. **Explain Aloud**: Practice explaining your approach
6. **Review Mistakes**: Learn from every mistake
7. **Stay Calm**: Take deep breaths, think clearly
8. **Ask Questions**: Clarify before coding

---

## Resources for Review

- **CORE_ALGORITHM_PATTERNS.md**: All 8 essential patterns
- **C_SHARP_QUICK_REFERENCE.md**: C# methods and operations
- **PROBLEM_SOLVING_TEMPLATE.md**: Step-by-step framework
- **10_DAY_INTENSIVE_ROADMAP.md**: Daily schedule
- **DAILY_PRACTICE_SCHEDULE.md**: Specific problems to practice

---

**Remember**: Deloitte values clean, maintainable, testable code. Focus on writing code that's easy to read and understand, not just code that works!

Good luck! 🚀
