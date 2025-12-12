# Concept Drills - High-Impact Exercises
*15 Critical Drills with Comprehensive Explanations*

---

## Drill 1: Code Tracing - Value vs Reference Types

**What will this code output?**

```csharp
int a = 5;
int b = a;
b = 10;
Console.WriteLine(a);

var list1 = new List<int> { 1, 2, 3 };
var list2 = list1;
list2.Add(4);
Console.WriteLine(list1.Count);
```

**Answer**: First output: `5`, Second output: `4`

*Explanation: `int` is value type - `b = a` creates copy, changing `b` doesn't affect `a`. `List<int>` is reference type - `list2 = list1` copies reference, both point to same object. Time Complexity: O(1) for both operations. Common Mistake: Expecting value type behavior from reference types.*

---

## Drill 2: String Immutability

**What will this code output?**

```csharp
string s = "Hello";
s.ToUpper();
Console.WriteLine(s);

string t = "World";
t = t.ToUpper();
Console.WriteLine(t);
```

**Answer**: First output: `Hello`, Second output: `WORLD`

*Explanation: Strings are immutable - operations return new strings. `s.ToUpper()` returns new string but doesn't modify `s`. `t = t.ToUpper()` assigns the new string to `t`. Time Complexity: O(n) where n is string length. Space Complexity: O(n) - new string created. Common Mistake: Forgetting to assign result of string operations.*

---

## Drill 3: LINQ Deferred Execution

**What happens here?**

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };
var query = numbers.Where(n => n > 2);
numbers.Add(6);
numbers.Add(7);
var result = query.ToList();
Console.WriteLine(result.Count);
```

**Answer**: `5` (elements: 3, 4, 5, 6, 7)

*Explanation: LINQ deferred execution - query executes when enumerated. `Where()` creates query, doesn't execute yet. Adding to `numbers` affects the query. `ToList()` executes query, includes newly added items. Time Complexity: O(n) when `ToList()` is called. Common Mistake: Expecting query to execute immediately.*

---

## Drill 4: Collection Modification During Iteration

**What's wrong with this code?**

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };
foreach (var num in numbers) {
    if (num % 2 == 0) {
        numbers.Remove(num);
    }
}
```

**Answer**: Throws `InvalidOperationException: Collection was modified`

*Explanation: Cannot modify collection during foreach iteration. Enumerator becomes invalid when collection is modified. Time Complexity: O(n) but throws exception. Common Mistake: Modifying collection in foreach loop. Fix: Use `RemoveAll()` or iterate backwards.*

**Fixed Code**:
```csharp
numbers.RemoveAll(n => n % 2 == 0);
// OR
for (int i = numbers.Count - 1; i >= 0; i--) {
    if (numbers[i] % 2 == 0) {
        numbers.RemoveAt(i);
    }
}
```

---

## Drill 5: Integer Division

**What is the result?**

```csharp
int a = 7 / 2;
double b = 7 / 2;
double c = 7.0 / 2;
Console.WriteLine($"{a}, {b}, {c}");
```

**Answer**: `3, 3, 3.5`

*Explanation: Integer division truncates decimal part. `7 / 2` with int operands = 3 (truncated). `7 / 2` assigned to double = 3.0 (division happens first as int). `7.0 / 2` = 3.5 (one operand is double, so result is double). Time Complexity: O(1). Common Mistake: Expecting decimal result from integer division.*

---

## Drill 6: Dictionary Lookup

**What's the best way to safely get a value?**

```csharp
var dict = new Dictionary<string, int> { { "a", 1 }, { "b", 2 } };

// Option A
int value1 = dict["c"]; // Key doesn't exist

// Option B
if (dict.ContainsKey("c")) {
    int value2 = dict["c"];
}

// Option C
if (dict.TryGetValue("c", out int value3)) {
    // Use value3
}
```

**Answer**: Option C is best

*Explanation: Option A throws `KeyNotFoundException`. Option B works but double lookup O(2). Option C single lookup, safe O(1). Time Complexity: A O(1) but throws exception, B O(2) two hash lookups, C O(1) single hash lookup. Common Mistake: Using `ContainsKey()` then `dict[key]` - double lookup.*

---

## Drill 7: Async/Await Deadlock

**What's wrong with this code?**

```csharp
public string GetData() {
    return GetDataAsync().Result; // In UI or ASP.NET context
}

public async Task<string> GetDataAsync() {
    await Task.Delay(1000);
    return "data";
}
```

**Answer**: Can cause deadlock in UI/ASP.NET contexts

*Explanation: `.Result` blocks thread waiting for async method. Async method needs synchronization context to continue. Context is blocked, so async method can't complete - Deadlock! Time Complexity: Blocks indefinitely. Common Mistake: Using `.Result` or `.Wait()` on async methods. Fix: Use `await` instead of `.Result`.*

**Fixed Code**:
```csharp
public async Task<string> GetDataAsync() {
    await Task.Delay(1000);
    return "data";
}

// Caller must also be async
public async Task<string> GetData() {
    return await GetDataAsync();
}
```

---

## Drill 8: LINQ Multiple Enumeration

**What's the problem?**

```csharp
public IEnumerable<int> GetNumbers() {
    var query = database.Numbers.Where(n => n > 10);
    LogCount(query.Count()); // First enumeration
    return query; // Will be enumerated again by caller
}
```

**Answer**: Query executes twice against database

*Explanation: LINQ deferred execution causes multiple database queries. `Count()` executes query (first SQL query). Caller enumerates returned query (second SQL query). Two separate database round trips! Time Complexity: O(2n) - executes twice. Common Mistake: Multiple enumeration of deferred queries. Fix: Materialize with `ToList()` if enumerating multiple times.*

**Fixed Code**:
```csharp
public IEnumerable<int> GetNumbers() {
    var list = database.Numbers.Where(n => n > 10).ToList(); // Materialize
    LogCount(list.Count); // O(1), no query
    return list; // Returns materialized list
}
```

---

## Drill 9: Any() vs Count() Performance

**Which is more efficient for checking existence?**

```csharp
var collection = Enumerable.Range(1, 1000000);

// Option A
if (collection.Count(x => x > 500000) > 0) { }

// Option B
if (collection.Any(x => x > 500000)) { }
```

**Answer**: Option B is much more efficient

*Explanation: Option A `Count()` must count ALL matching elements O(n). Option B `Any()` stops at first match O(1) best case, O(n) worst case. Time Complexity: A O(n) always, B O(1) best case. Common Mistake: Using `Count() > 0` when `Any()` would short-circuit. Performance Impact: `Any()` can be 1,000,000x faster if first element matches!*

---

## Drill 10: Task.WhenAll() Parallel Execution

**What's the difference?**

```csharp
// Option A - Sequential
var users = await GetUsersAsync();      // 1 second
var orders = await GetOrdersAsync();    // 1 second
var products = await GetProductsAsync(); // 1 second
// Total: 3 seconds

// Option B - Parallel
var userTask = GetUsersAsync();
var orderTask = GetOrdersAsync();
var productTask = GetProductsAsync();
await Task.WhenAll(userTask, orderTask, productTask);
var users = await userTask;
var orders = await orderTask;
var products = await productTask;
// Total: 1 second (longest operation)
```

**Answer**: Option B is 3x faster

*Explanation: Option A operations run sequentially, total time = sum. Option B operations run in parallel, total time = max. Time Complexity: A O(time1 + time2 + time3), B O(max(time1, time2, time3)). Common Mistake: Using sequential await when operations are independent. Performance Impact: Can be 3-10x faster depending on number of operations.*

---

## Drill 11: String Concatenation Performance

**Which is most efficient for 1000 items?**

```csharp
var items = Enumerable.Range(0, 1000).Select(i => i.ToString());

// Option A
string result = "";
foreach (var item in items) {
    result += item; // Creates new string each time
}

// Option B
var sb = new StringBuilder();
foreach (var item in items) {
    sb.Append(item);
}
string result = sb.ToString();

// Option C
string result = string.Join("", items);
```

**Answer**: Option C (or B, both are good)

*Explanation: Option A creates 1000 intermediate strings O(n^2) time and space. Option B StringBuilder efficiently builds string O(n) time and space. Option C optimized for joining collections O(n) time and space. Time Complexity: A O(n^2), B O(n), C O(n). Space Complexity: A O(n^2), B O(n), C O(n). Common Mistake: Using `+=` in loops. Performance Impact: Option A can be 1000x slower for large collections!*

---

## Drill 12: ValueTask vs Task

**When should you use ValueTask?**

```csharp
// Scenario: High-frequency caching method
public async ValueTask<string> GetCachedDataAsync(string key) {
    if (cache.TryGetValue(key, out var value)) {
        return value; // Cache hit - synchronous completion
    }
    return await FetchFromDatabaseAsync(key); // Cache miss - async
}
```

**Answer**: Use ValueTask for high-frequency methods that often complete synchronously

*Explanation: Cache hit returns immediately (synchronous) - no Task allocation. Cache miss returns Task (async) - allocates Task. Time Complexity: Same for both Task and ValueTask. Space Complexity: Task always allocates ~100 bytes on heap. ValueTask no allocation for sync completion, allocates only for async. Common Mistake: Using Task for high-frequency sync-completing methods. Performance Impact: Reduces GC pressure significantly for high-frequency calls.*

---

## Drill 13: Records Value Equality

**What's the output?**

```csharp
public record Person(string Name, int Age);

var p1 = new Person("Alice", 30);
var p2 = new Person("Alice", 30);
var p3 = p1;

Console.WriteLine(p1 == p2);  // ?
Console.WriteLine(p1 == p3);  // ?
Console.WriteLine(ReferenceEquals(p1, p2)); // ?
Console.WriteLine(ReferenceEquals(p1, p3)); // ?
```

**Answer**: `p1 == p2`: `True` (value equality), `p1 == p3`: `True` (same reference), `ReferenceEquals(p1, p2)`: `False` (different objects), `ReferenceEquals(p1, p3)`: `True` (same reference)

*Explanation: Records provide value-based equality. `==` operator uses value equality for records. `ReferenceEquals()` checks reference equality. Records are reference types but compare by value. Time Complexity: O(n) where n is number of properties. Common Mistake: Expecting reference equality from `==` operator.*

---

## Drill 14: Nullable Reference Types

**What happens here?**

```csharp
#nullable enable

string? nullableString = null;     // OK
string nonNullableString = null;   // Warning!

int? length1 = nullableString?.Length;        // OK, returns null
int length2 = nullableString.Length;          // Warning! Possible null reference
int length3 = nullableString?.Length ?? 0;    // OK, provides default
```

**Answer**: Compiler warnings for potential null references

*Explanation: Nullable reference types help prevent null reference exceptions. `string?` explicitly marks as nullable. `string` (non-nullable) warns if assigned null. Null-conditional operator `?.` safely accesses members. Null-coalescing operator `??` provides default. Time Complexity: No runtime impact, compile-time checks. Common Mistake: Not using nullable annotations, missing null checks.*

---

## Drill 15: Pattern Matching

**What does this code do?**

```csharp
object obj = "Hello";

// Old way
if (obj is string) {
    string s = (string)obj;
    Console.WriteLine(s.ToUpper());
}

// Modern way
if (obj is string s) {
    Console.WriteLine(s.ToUpper());
}

// Switch expression
var result = obj switch {
    string str => str.ToUpper(),
    int num => num.ToString(),
    null => "null",
    _ => "unknown"
};
```

**Answer**: Pattern matching simplifies type checking and casting

*Explanation: Modern C# pattern matching simplifies conditional logic. Type pattern `is string s` checks type and assigns in one step. Switch expression provides concise conditional logic. More readable than if-else chains. Time Complexity: O(1) for type checks. Common Mistake: Using verbose if-else when pattern matching would be cleaner.*

---

## Key Takeaways from Drills

1. Value vs Reference: Understand when changes affect original
2. String Immutability: Always assign result of string operations
3. LINQ Deferred Execution: Queries execute when enumerated, not when created
4. Collection Modification: Never modify collection during foreach iteration
5. Integer Division: Truncates decimal part, use `7.0 / 2` for decimal result
6. Dictionary Lookup: Use `TryGetValue()` for safe lookups
7. Async Deadlocks: Never use `.Result` or `.Wait()`, always use `await`
8. Multiple Enumeration: Materialize LINQ queries if enumerating multiple times
9. Any() vs Count(): Use `Any()` for existence checks, it short-circuits
10. Parallel Execution: Use `Task.WhenAll()` for independent async operations
11. String Concatenation: Use `string.Join()` or `StringBuilder`, never `+=` in loops
12. ValueTask: Use for high-frequency methods that often complete synchronously
13. Records: Provide value-based equality, not reference equality
14. Nullable Types: Use annotations to prevent null reference exceptions
15. Pattern Matching: Simplifies type checking and conditional logic

Practice these drills until you can explain WHY each answer is correct!


