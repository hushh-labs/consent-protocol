# Deloitte Interview Prep - Complete Index

**Your Roadmap to Success | December 4, 2025**

---

## 📖 How to Use This Index

This is your **textbook table of contents**. Everything you need is organized by purpose, not by folder number.

**Quick Navigation**:

- **Part I**: Getting Started (Read First)
- **Part II**: Core Concepts & Patterns
- **Part III**: Problem Practice by Pattern
- **Part IV**: Architecture & System Design
- **Part V**: Behavioral & STAR Stories
- **Part VI**: SQL Practice
- **Part VII**: Last-Minute Review

---

## Part I: Getting Started

### Chapter 1: Start Here

📄 [**New Interview Patterns Guide**](./INTERVIEW_PATTERNS_GUIDE.md) ⭐ **READ THIS FIRST**

- Your complete pattern reference
- What you've mastered vs gaps
- Round 1-3 strategy

📄 [Revised Preparation Plan](./REVISED_PREPARATION_PLAN.md)

- 13-day schedule (Nov 21 - Dec 3)
- Daily practice routine
- Time management strategy

📄 [Interview Day Guide](./interview_day_guide.md) _(if exists)_

- Day-of checklist
- Environment setup
- Mental preparation

---

## Part II: Core Concepts & Patterns

### Chapter 2: Algorithm Patterns (The Bible)

📂 Location: `01_Concepts/`

📄 [**CORE_ALGORITHM_PATTERNS.md**](../01_Concepts/CORE_ALGORITHM_PATTERNS.md) ⭐ CRITICAL

- 8 essential patterns (Hash Map, Two Pointers, Sliding Window, Binary Search, etc.)
- Templates in C#, TypeScript, JavaScript
- Time/space complexity for each
- LeetCode examples

📄 [**INTERVIEW_PATTERNS_GUIDE.md**](./INTERVIEW_PATTERNS_GUIDE.md) ⭐ NEW

- Tailored to Deloitte interview
- Your progress tracker
- Quick pattern recognition

### Chapter 3: Language-Specific References

📂 Location: `01_Concepts/`

📄 [C# Quick Reference](../01_Concepts/C_SHARP_QUICK_REFERENCE.md)

- LINQ patterns
- Async/await
- Dictionary operations
- Common gotchas

📄 [JavaScript/TypeScript Quick Reference](../01_Concepts/JS_TS_QUICK_REFERENCE.md)

- Map/Set operations
- Array methods
- String manipulation

### Chapter 4: Architecture & Design Patterns

📂 Location: `01_Concepts/`

📄 [**ARCHITECTURE_BASICS.md**](../01_Concepts/ARCHITECTURE_BASICS.md) ⭐ NEW

- 4+1 View Model
- Non-Functional Requirements (NFRs)
- Integration Patterns
- Interview cheat sheet

📄 [Architecture & Design Patterns](../01_Concepts/architecture_design_patterns.md)

- Singleton, Factory, Builder, Repository
- When to use each pattern
- C# implementations
- SHL assessment tips

### Chapter 5: Round 1 Focus

📂 Location: `01_Concepts/`

📄 [DELOITTE_ROUND1_FOCUS.md](../01_Concepts/DELOITTE_ROUND1_FOCUS.md)

- Verified Deloitte problems
- SQL problems (20% of interviews!)
- Frequency distribution
- Must-know templates

---

## Part III: Problem Practice by Pattern

### Chapter 6: Hash Map / Frequency Counting ✅

**Problems You've Solved**:

1. [Two Sum](../02_LeetCode_Practice/01_Two_Sum/) - #1, Easy, 87.5% frequency ⭐
2. [First Unique Character](../02_LeetCode_Practice/22_First_Unique_Character_In_A_String/) - #387, Easy, 75% frequency ⭐

**Pattern**: Count frequencies, find pairs, O(1) lookup
**Your Insight**: Iterate over map (26 keys) instead of string (N chars) for optimization

**Should Practice**:

- Group Anagrams (#49)
- Longest Consecutive Sequence (#128)

---

### Chapter 7: Two Pointers ✅

**Problems You've Solved**:

1. [Container With Most Water](../02_LeetCode_Practice/20_Container_With_Most_Water/) - #11, Medium, 75% frequency ⭐
2. [Valid Parentheses](../02_LeetCode_Practice/19_Valid_Parentheses/) - #20, Easy, 75% frequency ⭐ (Stack)

**Pattern**: Sorted arrays, palindromes, O(N) time, O(1) space
**Your Insight**: Move the shorter/limiting element

**Should Practice**:

- 3Sum (#15) - 50% frequency
- Valid Palindrome (#125)

---

### Chapter 8: Stack ✅

**Problems You've Solved**:

1. [Valid Parentheses](../02_LeetCode_Practice/19_Valid_Parentheses/) - #20, Easy, 75% frequency ⭐

**Pattern**: Matching pairs, nested structures
**Template**: Push opening, pop for closing, check match

---

### Chapter 9: Greedy / One Pass Optimization ✅

**Problems You've Solved**:

1. [Best Time to Buy and Sell Stock](../02_LeetCode_Practice/21_Best_Time_To_Buy_And_Sell_Stock/) - #121, Easy, 75% frequency ⭐

**Pattern**: Track best so far, single pass
**Your Insight**: Only need best price in the past, not exact index

---

### Chapter 10: Bit Manipulation ✅

**Problems You've Solved**:

1. [Counting Bits](../02_LeetCode_Practice/16_Counting_Bits/) - #338, Easy

**Pattern**: Power of 2, count bits, XOR
**Key Operations**: `i >> 1`, `i & 1`, `i & (i-1)`

---

### Chapter 11: Divide & Conquer ✅

**Problems You've Solved**:

1. [Merge k Sorted Lists](../02_LeetCode_Practice/17_Merge_k_Sorted_Lists/) - #23, Hard, 100% frequency ⭐ CRITICAL

**Pattern**: Can I solve half? O(N log k)
**Your Insight**: Knockout tournament analogy

---

### Chapter 12: Expand Around Center ✅

**Problems You've Solved**:

1. [Longest Palindromic Substring](../02_LeetCode_Practice/18_Longest_Palindromic_Substring/) - #5, Medium, 87.5% frequency ⭐ CRITICAL

**Pattern**: Palindromes, symmetric structures
**Template**: Check odd (i, i) and even (i, i+1) centers

---

### Chapter 13: Sliding Window ⚠️ GAP

**Pattern**: Substring/subarray with property
**Must Practice**: Longest Substring Without Repeating Characters (#3) - 50% frequency

**Template**:

```javascript
let left = 0,
  window = new Set();
for (let right = 0; right < s.length; right++) {
  while (window.has(s[right])) {
    window.delete(s[left++]);
  }
  window.add(s[right]);
}
```

---

### Chapter 14: Binary Search ⚠️ GAP

**Existing Problems in Your Repo**:

- [Search Insert Position](../02_LeetCode_Practice/06_Search_Insert_Position/)
- [Sqrt(x)](../02_LeetCode_Practice/08_Sqrt_X/)

**Pattern**: Sorted array, O(log N)
**Must Review**: Binary search template

---

### Chapter 15: Tree Traversal (DFS/BFS)

**Existing Problems**:

- [Subtree of Another Tree](../02_LeetCode_Practice/14_Subtree_Of_Another_Tree/) - #572
- [Construct Binary Tree from Preorder and Inorder](../02_LeetCode_Practice/15_Construct_Binary_Tree_From_Preorder_And_Inorder/)

**Pattern**: Tree problems, recursion
**Should Review**: DFS preorder, inorder, postorder

---

### Chapter 16: Dynamic Programming

**Existing Problems**:

- [Coin Change](../02_LeetCode_Practice/12_Coin_Change/) - #322
- [Product of Array Except Self](../02_LeetCode_Practice/11_Product_Of_Array_Except_Self/)
- [Longest Consecutive Sequence](../02_LeetCode_Practice/13_Longest_Consecutive_Sequence/)

**Pattern**: Overlapping subproblems, memoization

---

### Chapter 17: All Other Problems (For Reference)

**Easy Problems** (Good for warm-up):

- [Add Two Numbers](../02_LeetCode_Practice/02_Add_Two_Numbers/)
- [Reverse Integer](../02_LeetCode_Practice/04_Reverse_Integer/)
- [Plus One](../02_LeetCode_Practice/07_Plus_One/)
- [Remove Element](../02_LeetCode_Practice/09_Remove_Element/)
- [Add Binary](../02_LeetCode_Practice/10_Add_Binary/)

**Hard Problems** (Confidence builders):

- [Median of Two Sorted Arrays](../02_LeetCode_Practice/03_Median_Of_Two_Sorted_Arrays/)
- [Divide Two Integers](../02_LeetCode_Practice/05_Divide_Two_Integers/)

---

## Part IV: SQL Practice ⚠️ CRITICAL GAP

### Chapter 18: SQL for Deloitte (20% of Round 1)

📂 Location: `02_LeetCode_Practice/00_Deloitte_Specific/`

📄 [DELOITTE_VERIFIED_PROBLEMS.md](../02_LeetCode_Practice/00_Deloitte_Specific/DELOITTE_VERIFIED_PROBLEMS.md)

- Second Highest Salary (#176) - 75% frequency
- Change Null Values (#2388) - 87.5% frequency
- Managers with 5+ Reports (#570) - 75% frequency

**Essential SQL Concepts** (Study from DELOITTE_ROUND1_FOCUS.md):

- Window Functions (LAG, LEAD, ROW_NUMBER)
- Aggregation (GROUP BY, HAVING)
- Joins (Self Join, LEFT JOIN)
- Date Functions (DATEDIFF)

**Action**: Practice 3 SQL problems before Dec 4

---

## Part V: Behavioral & STAR Stories

### Chapter 19: Behavioral Prep

📂 Location: Likely in `03_Behavioral/` or similar

**Key Projects to Highlight**:

1. **Disney SharePoint Migration** - 1M+ files, 10K+ users
2. **GenZDealz ML Pipeline** - 87% accuracy
3. **Pro Kabaddi League** - Distributed teams
4. **AI-first workflows** - Innovation

**STAR Template**:

- **Situation**: Context (1-2 sentences)
- **Task**: Your responsibility
- **Action**: What YOU did (most important!)
- **Result**: Measurable outcome

---

## Part VI: System Design & Architecture

### Chapter 20: Architecture Basics

📄 [ARCHITECTURE_BASICS.md](../01_Concepts/ARCHITECTURE_BASICS.md) ⭐ NEW

- 4+1 View Model (Logical, Process, Development, Physical, Scenarios)
- NFRs (Scalability, Availability, Reliability, Security, Maintainability)
- Integration Patterns (API Gateway, Event-Driven, Microservices)

**Interview Cheat Sheet**:

- "I use the 4+1 model to ensure I'm communicating the right view"
- "We should implement a Circuit Breaker for cascading failures"
- "We need encryption in transit (TLS) and at rest"

---

## Part VII: Last-Minute Review (Day Before)

### Quick Reference Cards

📂 Location: `01_Concepts/`

**Review These on Dec 3**:

1. [INTERVIEW_PATTERNS_GUIDE.md](./INTERVIEW_PATTERNS_GUIDE.md) - 15 min
2. Pattern templates (Hash Map, Two Pointers, etc.) - 10 min
3. Time complexity cheat sheet - 5 min
4. SQL window functions - 10 min

**Warm-up on Dec 4 Morning**:

- Solve Two Sum (5 min)
- Review ARCHITECTURE_BASICS.md (5 min)

---

## Directory Structure (For Reference)

```
Deloitte_NET/
├── 00_START_HERE/
│   ├── INDEX.md (This file)
│   ├── INTERVIEW_PATTERNS_GUIDE.md ⭐ NEW
│   └── REVISED_PREPARATION_PLAN.md
│
├── 01_Concepts/
│   ├── ARCHITECTURE_BASICS.md ⭐ NEW
│   ├── CORE_ALGORITHM_PATTERNS.md ⭐
│   ├── DELOITTE_ROUND1_FOCUS.md ⭐
│   ├── C_SHARP_QUICK_REFERENCE.md
│   ├── JS_TS_QUICK_REFERENCE.md
│   └── architecture_design_patterns.md
│
├── 02_LeetCode_Practice/
│   ├── 00_Deloitte_Specific/
│   │   └── DELOITTE_VERIFIED_PROBLEMS.md
│   ├── 16_Counting_Bits/ ✅
│   ├── 17_Merge_k_Sorted_Lists/ ✅
│   ├── 18_Longest_Palindromic_Substring/ ✅
│   ├── 19_Valid_Parentheses/ ✅
│   ├── 20_Container_With_Most_Water/ ✅
│   ├── 21_Best_Time_To_Buy_And_Sell_Stock/ ✅
│   └── 22_First_Unique_Character_In_A_String/ ✅
│
└── [Other directories as they exist]
```

---

## Your Success Checklist

### Before Interview (Dec 4)

- [ ] Read INTERVIEW_PATTERNS_GUIDE.md
- [ ] Practice 3 SQL problems
- [ ] Review Sliding Window template
- [ ] Review Binary Search template
- [ ] Prepare STAR stories

### Interview Day

- [ ] Warm up with Two Sum
- [ ] Review pattern recognition (2 min)
- [ ] Test camera/mic
- [ ] Have water & notes ready

### After Each Problem

- [ ] Identify pattern (30 sec)
- [ ] Explain approach before coding
- [ ] Think out loud
- [ ] Test with edge cases
- [ ] Discuss complexity

---

**You've solved 7 problems across 7 different patterns. You're 70% ready. Focus on SQL and you'll be at 85%. You've got this! 🚀**
