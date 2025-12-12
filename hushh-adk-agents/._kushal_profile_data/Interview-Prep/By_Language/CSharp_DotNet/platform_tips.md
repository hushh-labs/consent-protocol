# Online Assessment Platform Tips

_Platform-specific tips and modern C# features for .NET online assessments_

---

## Online Assessment Platform Essentials

### Before You Start

- **Browser Compatibility**: Use Chrome, Firefox, or Edge (latest versions)
- **Test your system**: Test browser, camera, microphone if video interview
- **Stable internet**: Close bandwidth-heavy apps (streaming, downloads)
- **Clean workspace**: Close all other browser tabs and applications
- **Full screen mode**: Maximize your browser window
- **Read instructions**: Understand platform-specific rules and features

### During the Assessment

- **Timer awareness**: Monitor time remaining, but don't fixate
- **Navigation**: Understand if you can go back to previous questions (varies by platform)
- **Auto-save**: Confirm if answers are saved automatically
- **Technical issues**: Know how to report problems (usually a button or contact method)
- **Question format**: Understand if questions are adaptive or fixed difficulty

### Common Question Patterns

- **"BEST" vs "CORRECT"**: Multiple answers may work, choose the BEST one
- **Code analysis**: "What will this output?" - trace through mentally
- **Efficiency focus**: Often asks "most efficient" or "best performance"
- **Real-world scenarios**: Practical application over pure theory

---

## Modern C# Features (C# 10, 11, 12)

### Records (C# 9+)

Immutable reference types with value-based equality

```csharp
// Record declaration
public record Person(string Name, int Age);

// Usage
var person1 = new Person("Alice", 30);
var person2 = person1 with { Age = 31 }; // Non-destructive mutation

// Value-based equality
var p1 = new Person("Bob", 25);
var p2 = new Person("Bob", 25);
Console.WriteLine(p1 == p2); // True (value equality)
```

**Key Points:**

- Immutable by default
- Built-in value equality
- `with` expression for copying with changes
- Great for DTOs and value objects

**Record Structs (C# 10):**

```csharp
public record struct Point(int X, int Y);
```

---

### Pattern Matching Enhancements

**Property Pattern:**

```csharp
if (obj is Person { Age: > 18, Name: "Alice" })
{
    // Matches Person with Age > 18 and Name = "Alice"
}
```

**Switch Expression (C# 8+):**

```csharp
var result = value switch
{
    0 => "zero",
    > 0 and < 10 => "single digit",
    >= 10 and < 100 => "double digit",
    _ => "large number"
};
```

**Type Pattern:**

```csharp
object obj = "Hello";
if (obj is string s)
{
    Console.WriteLine(s.ToUpper());
}
```

**List Pattern (C# 11):**

```csharp
int[] numbers = { 1, 2, 3 };
var result = numbers switch
{
    [] => "empty",
    [var x] => $"single: {x}",
    [var x, var y] => $"pair: {x}, {y}",
    [var first, .., var last] => $"first: {first}, last: {last}",
    _ => "other"
};
```

---

### Nullable Reference Types (C# 8+)

Helps prevent null reference exceptions at compile time

```csharp
#nullable enable

string? nullableString = null; // OK
string nonNullableString = null; // Compiler warning!

// Null-forgiving operator
string? maybeNull = GetString();
string definitelyNotNull = maybeNull!; // Override warning (use carefully!)

// Null-conditional operator
int? length = nullableString?.Length; // Returns null if nullableString is null
```

**Common Patterns:**

```csharp
// Null-coalescing assignment (C# 8)
string? name = null;
name ??= "Default"; // Assign only if null

// Null-coalescing operator
string result = name ?? "Unknown";
```

---

### Init-Only Properties (C# 9)

Properties that can only be set during object initialization

```csharp
public class Person
{
    public string Name { get; init; }
    public int Age { get; init; }
}

// Usage
var person = new Person { Name = "Alice", Age = 30 };
// person.Name = "Bob"; // Compiler error!
```

**Benefits:**

- Immutability without verbose constructors
- Works with object initializers
- Better than read-only properties with constructor injection

---

### Top-Level Statements (C# 9)

No need for explicit Program class and Main method

```csharp
// Before
public class Program
{
    public static void Main(string[] args)
    {
        Console.WriteLine("Hello");
    }
}

// Now (C# 9+)
Console.WriteLine("Hello");
```

**Note**: Less common in assessment questions but good to recognize

---

### Global Using Directives (C# 10)

Declare usings once for entire project

```csharp
// GlobalUsings.cs
global using System;
global using System.Collections.Generic;
global using System.Linq;

// Now available in all files without explicit using statements
```

---

### Required Members (C# 11)

Force properties to be set during initialization

```csharp
public class Person
{
    public required string Name { get; init; }
    public int Age { get; init; }
}

// Must set required properties
var person = new Person { Name = "Alice", Age = 30 }; // OK
var person2 = new Person { Age = 30 }; // Compiler error - Name is required!
```

---

### Raw String Literals (C# 11)

Easier multi-line strings without escaping

```csharp
// Triple quotes for raw strings
string json = """
{
    "name": "Alice",
    "age": 30
}
""";

// No need to escape quotes or newlines!
```

---

## Performance Optimization Concepts

### Span<T> and Memory<T>

High-performance, zero-allocation access to contiguous memory

```csharp
// Span<T> - stack-allocated, very fast
int[] array = { 1, 2, 3, 4, 5 };
Span<int> span = array.AsSpan();
Span<int> slice = span.Slice(1, 3); // { 2, 3, 4 }

// Memory<T> - can be used in async methods (Span cannot)
Memory<int> memory = array.AsMemory();
await ProcessAsync(memory);
```

**Key Points:**

- Zero allocations - no GC pressure
- Stack-allocated (Span) or heap (Memory)
- Great for high-performance scenarios
- Span cannot be used in async methods

**Common Use Cases:**

```csharp
// String manipulation without allocations
ReadOnlySpan<char> span = "Hello World".AsSpan();
ReadOnlySpan<char> hello = span.Slice(0, 5); // "Hello"

// Parsing without substring allocations
ReadOnlySpan<char> numberSpan = span.Slice(0, 5);
if (int.TryParse(numberSpan, out int result))
{
    Console.WriteLine(result);
}
```

---

### ValueTask vs Task

More efficient for synchronous completion paths

```csharp
// Task - always allocates
public async Task<int> GetValueAsync()
{
    return await SomeAsyncOperation();
}

// ValueTask - no allocation if result is immediately available
public async ValueTask<int> GetValueAsync()
{
    if (cache.TryGetValue(key, out var value))
        return value; // No allocation!

    return await FetchFromDatabaseAsync();
}
```

**When to use ValueTask:**

- High-frequency calls
- Often completes synchronously (cached results)
- Performance-critical code

**When to stick with Task:**

- Infrequent calls
- Always truly async
- Default choice for most scenarios

---

### ArrayPool<T>

Reuse arrays to reduce GC allocations

```csharp
// Without ArrayPool (creates garbage)
byte[] buffer = new byte[1024];
ProcessData(buffer);
// Buffer becomes garbage

// With ArrayPool (reuses arrays)
var pool = ArrayPool<byte>.Shared;
byte[] buffer = pool.Rent(1024);
try
{
    ProcessData(buffer);
}
finally
{
    pool.Return(buffer); // Return to pool for reuse
}
```

**Key Points:**

- Reduces GC pressure in hot paths
- Always return rented arrays
- Use try-finally to ensure return
- Buffer may be larger than requested

---

### String Concatenation Performance

```csharp
// BAD - Creates many intermediate strings
string result = "";
for (int i = 0; i < 1000; i++)
{
    result += i.ToString(); // Very slow!
}

// GOOD - StringBuilder for loops
var sb = new StringBuilder();
for (int i = 0; i < 1000; i++)
{
    sb.Append(i);
}
string result = sb.ToString();

// BEST - String.Join for collections
var numbers = Enumerable.Range(0, 1000);
string result = string.Join("", numbers);

// GOOD - String interpolation for few items
string result = $"{a}{b}{c}"; // Fine for small number
```

---

### Collection Initialization Performance

```csharp
// Good - Pre-size if you know capacity
var list = new List<int>(1000); // Avoids internal array resizing

// Good - Use Collection Expressions (C# 12)
int[] numbers = [1, 2, 3, 4, 5];
List<string> names = ["Alice", "Bob", "Charlie"];

// Spreading (C# 12)
int[] array1 = [1, 2, 3];
int[] array2 = [4, 5, 6];
int[] combined = [..array1, ..array2]; // [1, 2, 3, 4, 5, 6]
```

---

## Common Performance Pitfalls

### 1. LINQ Deferred Execution

```csharp
// BAD - Re-executes query every iteration
var query = GetExpensiveData().Where(x => x.IsActive);
foreach (var item in query) { } // Executes query
var count = query.Count(); // Executes query AGAIN!

// GOOD - Materialize once
var items = GetExpensiveData().Where(x => x.IsActive).ToList();
foreach (var item in items) { } // Uses materialized list
var count = items.Count; // O(1), no re-query
```

### 2. Multiple Enumeration

```csharp
// BAD
IEnumerable<int> numbers = GetNumbers(); // Expensive operation
if (numbers.Any()) // First enumeration
{
    ProcessAll(numbers); // Second enumeration
}

// GOOD
var numbers = GetNumbers().ToList(); // Single enumeration
if (numbers.Count > 0)
{
    ProcessAll(numbers);
}
```

### 3. Unnecessary Boxing

```csharp
// BAD - Boxing value type to object
int number = 42;
object obj = number; // Boxing allocation!
Console.WriteLine(obj);

// GOOD - Use generics to avoid boxing
void Print<T>(T value) => Console.WriteLine(value);
Print(42); // No boxing
```

### 4. String in Hot Loops

```csharp
// BAD
for (int i = 0; i < 1000; i++)
{
    string s = i.ToString(); // 1000 allocations
    Process(s);
}

// GOOD - Reuse StringBuilder or use Span
Span<char> buffer = stackalloc char[16];
for (int i = 0; i < 1000; i++)
{
    i.TryFormat(buffer, out int written);
    Process(buffer.Slice(0, written));
}
```

---

## Algorithm Complexity Quick Reference

**Common Time Complexities:**

- O(1) - Constant: Array access, Dictionary lookup
- O(log n) - Logarithmic: Binary search, balanced tree
- O(n) - Linear: Array iteration, List.Contains
- O(n log n) - Linearithmic: Efficient sorting (QuickSort, MergeSort)
- O(n²) - Quadratic: Nested loops, bubble sort

**Collection Operations:**

```
List<T>:
  - Access by index: O(1)
  - Add: O(1) amortized
  - Insert/Remove: O(n)
  - Contains: O(n)

Dictionary<K,V>:
  - Add/Remove/Lookup: O(1) average
  - Worst case: O(n) (rare)

HashSet<T>:
  - Add/Remove/Contains: O(1) average

SortedDictionary<K,V>:
  - Add/Remove/Lookup: O(log n)
```

---

## Test-Taking Strategy

### Time Management

- **Allocate time**: Calculate time per question based on total time and question count
- **First pass**: Answer what you know immediately
- **Second pass**: Tackle harder questions
- **Final pass**: Quick review if time permits

### Question Approach

1. **Read completely**: Don't skim - watch for "NOT", "EXCEPT", "BEST"
2. **Eliminate wrong answers**: Narrow down choices
3. **Trust your instincts**: First answer is often correct
4. **Skip and return**: Don't get stuck on one question

### Code Analysis Questions

1. **Trace step-by-step**: Don't rush
2. **Watch for edge cases**: null, empty, zero, negative
3. **Check types**: Value vs reference, int division
4. **Look for common gotchas**: String immutability, LINQ deferred execution

### "BEST" Solution Questions

- Consider: Performance, maintainability, security
- Modern patterns usually preferred over legacy
- LINQ/functional style over loops (when appropriate)
- Defensive programming (null checks, validation)

---

## Pre-Assessment Checklist (Day Of)

**15 Minutes Before:**

- [ ] Browser check (Chrome/Firefox/Edge updated)
- [ ] Close all other apps and browser tabs
- [ ] Have stable internet connection
- [ ] Find quiet, distraction-free space
- [ ] Have pen/paper for quick notes
- [ ] Review key points from preparation materials

**Mental Prep:**

- [ ] Take deep breath, stay calm
- [ ] Trust your preparation
- [ ] Focus on one question at a time
- [ ] Remember: You're well-prepared

---

## Last-Minute Memory Aids

**Modern C# Must-Know:**

- Records: Immutable with `with` expression
- Pattern matching: `is` and `switch` expressions
- Nullable: `?` suffix, `??` operator
- Init: Set once during initialization

**Performance Must-Know:**

- Span<T>: Zero-allocation slicing
- ValueTask: For frequently-sync operations
- StringBuilder: For string concatenation in loops
- ToList(): Materialize LINQ to avoid re-enumeration

**Collections Complexity:**

- Dictionary/HashSet: O(1) lookup
- List: O(1) access, O(n) search
- SortedDictionary: O(log n) operations

---

**Good luck! You're well-prepared. Trust your knowledge and experience!**

