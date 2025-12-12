# C# Quick Reference for LeetCode

**Essential methods and patterns for Deloitte Round 1 Technical Assessment**

---

## Collections

### Dictionary<TKey, TValue>

**Purpose**: Key-value pairs with O(1) average lookup

```csharp
var dict = new Dictionary<int, int>();

// Operations
dict.Add(key, value);              // O(1) average
dict[key] = value;                 // O(1) average (add or update)
bool exists = dict.ContainsKey(key); // O(1) average
bool found = dict.TryGetValue(key, out int value); // O(1) average
dict.Remove(key);                  // O(1) average
int count = dict.Count;            // O(1)

// Iteration
foreach (var kvp in dict) { }     // O(n)
foreach (var key in dict.Keys) { } // O(n)
foreach (var val in dict.Values) { } // O(n)
```

**Common Patterns:**
```csharp
// Two Sum pattern
var indexMap = new Dictionary<int, int>();
for (int i = 0; i < nums.Length; i++) {
    int complement = target - nums[i];
    if (indexMap.ContainsKey(complement)) {
        return new[] { indexMap[complement], i };
    }
    indexMap[nums[i]] = i;
}

// Frequency counting
var freq = new Dictionary<char, int>();
foreach (char c in s) {
    freq[c] = freq.GetValueOrDefault(c, 0) + 1;
}
```

**Time Complexity**: O(1) average for Add, ContainsKey, TryGetValue, Remove  
**Space Complexity**: O(n) for n key-value pairs

---

### HashSet<T>

**Purpose**: Unique element storage with O(1) average lookup

```csharp
var set = new HashSet<int>();

// Operations
set.Add(value);                    // O(1) average
bool exists = set.Contains(value); // O(1) average
set.Remove(value);                 // O(1) average
int count = set.Count;             // O(1)

// Iteration
foreach (var item in set) { }      // O(n)
```

**Common Patterns:**
```csharp
// Check for duplicates
var seen = new HashSet<int>();
foreach (int num in nums) {
    if (seen.Contains(num)) return true;
    seen.Add(num);
}

// Sliding window - unique characters
var charSet = new HashSet<char>();
for (int right = 0; right < s.Length; right++) {
    while (charSet.Contains(s[right])) {
        charSet.Remove(s[left++]);
    }
    charSet.Add(s[right]);
}
```

**Time Complexity**: O(1) average for Add, Contains, Remove  
**Space Complexity**: O(n) for n elements

---

### List<T>

**Purpose**: Dynamic array with O(1) indexed access

```csharp
var list = new List<int>();

// Operations
list.Add(item);                    // O(1) amortized
list.AddRange(items);              // O(n)
list.Insert(index, item);          // O(n)
list.Remove(item);                 // O(n)
list.RemoveAt(index);              // O(n)
bool exists = list.Contains(item); // O(n)
int index = list.IndexOf(item);    // O(n)
int count = list.Count;            // O(1)

// Access
int value = list[index];           // O(1)
list[index] = value;               // O(1)
```

**Common Patterns:**
```csharp
// Initialize with values
var list = new List<int> { 1, 2, 3 };

// Convert to array
int[] arr = list.ToArray();

// Convert from array
var list = nums.ToList();
```

**Time Complexity**: 
- O(1) for indexed access, Add (amortized)
- O(n) for Contains, IndexOf, Remove, Insert

**Space Complexity**: O(n)

---

## LINQ Operations

**Purpose**: Query and transform collections

```csharp
using System.Linq;
```

### Filtering

```csharp
// Where - filter elements
var evens = nums.Where(x => x % 2 == 0).ToList(); // O(n)
var positives = nums.Where(x => x > 0);            // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n) for result

---

### Transformation

```csharp
// Select - transform elements
var squares = nums.Select(x => x * x).ToArray();    // O(n)
var lengths = words.Select(w => w.Length);          // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n)

---

### Aggregation

```csharp
// Sum, Count, Average
int sum = nums.Sum();                               // O(n)
int count = nums.Count();                           // O(n)
double avg = nums.Average();                        // O(n)

// Aggregate - custom aggregation
int product = nums.Aggregate(1, (acc, x) => acc * x); // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(1)

---

### Ordering

```csharp
// OrderBy - ascending
var sorted = nums.OrderBy(x => x).ToArray();         // O(n log n)
var sortedByLength = words.OrderBy(w => w.Length); // O(n log n)

// OrderByDescending - descending
var descending = nums.OrderByDescending(x => x);    // O(n log n)

// ThenBy - secondary sort
var multiSort = people.OrderBy(p => p.Age)
                      .ThenBy(p => p.Name);         // O(n log n)
```

**Time Complexity**: O(n log n)  
**Space Complexity**: O(n)

---

### Element Access

```csharp
// First, Last
int first = nums.First();                           // O(1)
int last = nums.Last();                            // O(1)
int firstEven = nums.First(x => x % 2 == 0);       // O(n)

// ElementAt
int third = nums.ElementAt(2);                     // O(1) for List, O(n) for IEnumerable

// Default if not found
int first = nums.FirstOrDefault();                 // O(1)
int firstEven = nums.FirstOrDefault(x => x % 2 == 0); // O(n)
```

**Time Complexity**: O(1) for First/Last on List, O(n) for First with predicate  
**Space Complexity**: O(1)

---

### Boolean Checks

```csharp
// Any - check if any element matches
bool hasEven = nums.Any(x => x % 2 == 0);          // O(n)
bool hasItems = nums.Any();                        // O(1)

// All - check if all elements match
bool allPositive = nums.All(x => x > 0);           // O(n)

// Contains
bool hasValue = nums.Contains(5);                 // O(n) for List
```

**Time Complexity**: O(n)  
**Space Complexity**: O(1)

---

### Grouping

```csharp
// GroupBy
var grouped = words.GroupBy(w => w.Length);        // O(n)
foreach (var group in grouped) {
    int length = group.Key;
    var words = group.ToList();
}
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n)

---

### Take/Skip

```csharp
// Take - first n elements
var first3 = nums.Take(3).ToList();               // O(n)

// Skip - skip first n elements
var rest = nums.Skip(3).ToList();                 // O(n)

// TakeWhile, SkipWhile
var untilNegative = nums.TakeWhile(x => x >= 0);  // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n)

---

## String Operations

### Basic Operations

```csharp
string s = "Hello World";

// Length
int len = s.Length;                                 // O(1)

// Indexing
char c = s[0];                                     // O(1)
```

**Time Complexity**: O(1)  
**Space Complexity**: O(1)

---

### Substring

```csharp
// Substring(startIndex, length)
string sub = s.Substring(0, 5);                    // O(length)
string rest = s.Substring(5);                      // O(length)

// Note: Creates new string (strings are immutable)
```

**Time Complexity**: O(length)  
**Space Complexity**: O(length)

---

### Search

```csharp
// IndexOf - find first occurrence
int index = s.IndexOf('o');                         // O(n)
int index = s.IndexOf("World");                     // O(n*m) where m is pattern length
int index = s.IndexOf('o', 5);                    // O(n) starting from index 5

// LastIndexOf - find last occurrence
int lastIndex = s.LastIndexOf('o');                // O(n)

// Contains
bool has = s.Contains("World");                    // O(n*m)
```

**Time Complexity**: O(n) for single char, O(n*m) for substring  
**Space Complexity**: O(1)

---

### Transformation

```csharp
// ToLower, ToUpper
string lower = s.ToLower();                        // O(n)
string upper = s.ToUpper();                        // O(n)

// Trim - remove whitespace
string trimmed = s.Trim();                         // O(n)
string trimmedStart = s.TrimStart();              // O(n)
string trimmedEnd = s.TrimEnd();                  // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n) - creates new string

---

### Split/Join

```csharp
// Split - string to array
string[] words = s.Split(' ');                     // O(n)
string[] parts = s.Split(new[] { ' ', ',' });     // O(n)

// Join - array to string
string joined = string.Join(" ", words);          // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n)

---

### Comparison

```csharp
// StartsWith, EndsWith
bool starts = s.StartsWith("Hello");               // O(m) where m is pattern length
bool ends = s.EndsWith("World");                  // O(m)

// Equals
bool equal = s.Equals("Hello World");             // O(n)
bool equalIgnoreCase = s.Equals("hello world", StringComparison.OrdinalIgnoreCase); // O(n)
```

**Time Complexity**: O(n) or O(m)  
**Space Complexity**: O(1)

---

## Array Operations

### Basic Operations

```csharp
int[] nums = new int[] { 1, 2, 3, 4, 5 };

// Length
int len = nums.Length;                             // O(1)

// Indexing
int value = nums[0];                               // O(1)
nums[0] = 10;                                     // O(1)

// Iteration
for (int i = 0; i < nums.Length; i++) { }        // O(n)
foreach (int num in nums) { }                     // O(n)
```

**Time Complexity**: O(1) for access, O(n) for iteration  
**Space Complexity**: O(1)

---

### Array Methods

```csharp
// Sort (in-place)
Array.Sort(nums);                                  // O(n log n)

// Reverse (in-place)
Array.Reverse(nums);                               // O(n)

// IndexOf
int index = Array.IndexOf(nums, 3);               // O(n)

// Resize
Array.Resize(ref nums, 10);                       // O(n)
```

**Time Complexity**: O(n log n) for Sort, O(n) for others  
**Space Complexity**: O(1) for in-place operations

---

## Common Patterns in C#

### Two Pointers

```csharp
int left = 0;
int right = nums.Length - 1;

while (left < right) {
    // Process nums[left] and nums[right]
    if (condition) {
        left++;
    } else {
        right--;
    }
}
```

**Time Complexity**: O(n)  
**Space Complexity**: O(1)

---

### Sliding Window

```csharp
int left = 0;
for (int right = 0; right < s.Length; right++) {
    // Expand window
    // Update state
    
    while (windowInvalid) {
        // Shrink window
        left++;
    }
    
    // Update result
}
```

**Time Complexity**: O(n) - each element visited at most twice  
**Space Complexity**: O(k) where k is window size

---

### Binary Search Template

```csharp
int left = 0;
int right = nums.Length - 1;

while (left <= right) {
    int mid = left + (right - left) / 2;  // Prevents overflow
    
    if (nums[mid] == target) {
        return mid;
    } else if (nums[mid] < target) {
        left = mid + 1;
    } else {
        right = mid - 1;
    }
}

return -1; // or left for insert position
```

**Time Complexity**: O(log n)  
**Space Complexity**: O(1)

---

### Frequency Counting

```csharp
// Using Dictionary
var freq = new Dictionary<char, int>();
foreach (char c in s) {
    freq[c] = freq.GetValueOrDefault(c, 0) + 1;
}

// Using LINQ GroupBy
var freq = s.GroupBy(c => c)
            .ToDictionary(g => g.Key, g => g.Count());
```

**Time Complexity**: O(n)  
**Space Complexity**: O(k) where k is unique characters

---

## Quick Lookup Tables

### Collection Selection Guide

| Need | Use | Time | Space |
|------|-----|------|-------|
| Key-value pairs | Dictionary | O(1) lookup | O(n) |
| Unique elements | HashSet | O(1) lookup | O(n) |
| Ordered, indexed | List | O(1) access | O(n) |
| Fixed size, indexed | Array | O(1) access | O(n) |

---

### LINQ Complexity Guide

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Where | O(n) | O(n) | Filter |
| Select | O(n) | O(n) | Transform |
| OrderBy | O(n log n) | O(n) | Sort |
| GroupBy | O(n) | O(n) | Group |
| First/Last | O(1) or O(n) | O(1) | O(n) if with predicate |
| Any/All | O(n) | O(1) | Boolean check |
| Count | O(n) | O(1) | Count elements |
| Sum/Average | O(n) | O(1) | Aggregate |

---

### String Operation Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Length | O(1) | O(1) | Property |
| IndexOf | O(n) | O(1) | Search |
| Substring | O(k) | O(k) | k = length |
| Contains | O(n*m) | O(1) | m = pattern length |
| ToLower/Upper | O(n) | O(n) | Creates new string |
| Split | O(n) | O(n) | Returns array |
| Join | O(n) | O(n) | Returns string |

---

## Common Mistakes to Avoid

1. **String Immutability**: Strings are immutable. Operations like `s.ToLower()` create new strings. Use `StringBuilder` for many concatenations.

2. **LINQ Deferred Execution**: LINQ queries are lazy. Call `.ToList()` or `.ToArray()` to materialize.

3. **Dictionary Key Access**: Use `TryGetValue` instead of checking `ContainsKey` then accessing (two lookups).

4. **Array vs List**: Use `Array` for fixed size, `List` for dynamic. `List` has overhead but flexibility.

5. **Overflow in Binary Search**: Use `left + (right - left) / 2` instead of `(left + right) / 2`.

6. **LINQ Performance**: `OrderBy` is O(n log n). Don't use unnecessarily. Consider if sorting is needed.

---

## Interview Tips

1. **Use LINQ Sparingly**: While LINQ is powerful, sometimes explicit loops are clearer and more efficient.

2. **Dictionary for Lookups**: Always use Dictionary/HashSet for O(1) lookups instead of List.Contains (O(n)).

3. **StringBuilder for Many Concatenations**: If building strings in loops, use StringBuilder.

4. **Know Your Complexities**: Be ready to explain time/space complexity of your solution.

5. **Edge Cases**: Always check for empty arrays, null values, single elements.

---

**Remember**: This is a quick reference. For detailed pattern explanations, see CORE_ALGORITHM_PATTERNS.md

