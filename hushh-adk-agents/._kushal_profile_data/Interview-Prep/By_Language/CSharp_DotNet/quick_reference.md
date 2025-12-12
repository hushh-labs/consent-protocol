# .NET Quick Reference

_Comprehensive guide with use cases, complexity, and common mistakes - last-minute cheat sheet_

---

## Collections: When to Use What

### List (Generic)

Dynamic array, resizable collection. Default choice for most scenarios. Use when you need indexed access (random access), when order matters, or when you need to add/remove at end frequently.

**Time Complexity**: Access by index O(1), Add at end O(1) amortized, Insert/Remove at position O(n), Contains/IndexOf O(n), Count O(1).

**Common Mistakes**: Using `List.Contains()` in loops (O(n^2) total) - use `HashSet` instead. Not pre-sizing when you know capacity: `new List<int>(1000)` avoids resizing. Using `Remove()` in loop - causes O(n^2) - use `RemoveAll()` or iterate backwards.

**Best Practice**: Pre-size if you know approximate capacity to avoid internal array resizing.

---

### Dictionary (Generic)

Hash table, key-value pairs. Use for fast lookups by key, when you need unique keys, mapping relationships (ID to Object), or caching scenarios.

**Time Complexity**: Add/Remove/Lookup O(1) average, worst case O(n) (rare, hash collision), ContainsKey O(1), Iteration O(n).

**Common Mistakes**: Using `dict[key]` without checking - throws `KeyNotFoundException`. Use `TryGetValue(key, out value)` instead. Adding duplicate keys - throws `ArgumentException`. Using `ContainsKey()` then `dict[key]` - double lookup, use `TryGetValue()`.

**Best Practice**: Always use `TryGetValue()` for lookups to avoid exceptions.

```csharp
// BAD
if (dict.ContainsKey(key)) {
    var value = dict[key]; // Double lookup!
}

// GOOD
if (dict.TryGetValue(key, out var value)) {
    // Use value
}
```

---

### HashSet (Generic)

Unordered collection of unique elements. Use for fast membership testing (Contains), removing duplicates, set operations (Union, Intersect, Except), or when you don't need order or indexing.

**Time Complexity**: Add/Remove/Contains O(1) average, worst case O(n), Set operations O(n) where n is size of larger set.

**Common Mistakes**: Using `List.Contains()` when `HashSet.Contains()` would be O(1) vs O(n). Expecting order - HashSet is unordered. Using for indexed access - not supported.

**Best Practice**: Use HashSet when you only need to check existence, not order.

```csharp
// BAD - O(n) for each Contains check
var list = new List<int> { 1, 2, 3, 4, 5 };
if (list.Contains(3)) { } // O(n)

// GOOD - O(1) for Contains check
var set = new HashSet<int> { 1, 2, 3, 4, 5 };
if (set.Contains(3)) { } // O(1)
```

---

### Queue (FIFO - Generic)

First In, First Out collection. Use for processing items in order received, BFS (Breadth-First Search) algorithms, task scheduling, or message queues.

**Time Complexity**: Enqueue O(1), Dequeue O(1), Peek O(1), Contains O(n).

**Common Mistakes**: Using `Dequeue()` on empty queue - throws `InvalidOperationException`. Use `TryDequeue()` or check `Count > 0` first.

---

### Stack (LIFO - Generic)

Last In, First Out collection. Use for Undo/Redo operations, expression evaluation, DFS (Depth-First Search) algorithms, or call stack simulation.

**Time Complexity**: Push O(1), Pop O(1), Peek O(1), Contains O(n).

**Common Mistakes**: Using `Pop()` on empty stack - throws `InvalidOperationException`. Use `TryPop()` or check `Count > 0` first.

---

## LINQ: Comprehensive Guide

### Deferred Execution

Query doesn't execute until enumerated. Can cause multiple executions and performance issues if not handled properly.

**Time Complexity**: Depends on operation (see below).

**Common Mistakes**: Multiple enumeration of same query. Assuming query executes immediately. Not materializing when needed multiple times.

```csharp
// BAD - Executes query twice!
var query = items.Where(x => x.IsActive);
var count = query.Count(); // First execution
var list = query.ToList(); // Second execution!

// GOOD - Materialize once
var list = items.Where(x => x.IsActive).ToList();
var count = list.Count; // O(1), no execution
```

---

### Where() - Filtering

Filters elements based on predicate. Use for filtering collections or removing unwanted items.

**Time Complexity**: O(n) - must check each element.

**Common Mistakes**: Using in nested loops (O(n^2)).

---

### Select() - Projection

Transforms each element. Use for mapping to different types or extracting properties.

**Time Complexity**: O(n).

**Common Mistakes**: Selecting entire objects when only need one property (memory waste).

---

### First() vs FirstOrDefault()

Gets first element. Use `First()` when you're sure element exists. Use `FirstOrDefault()` when element might not exist.

**Time Complexity**: O(n) worst case, O(1) best case (if first matches).

**Common Mistakes**: Using `First()` on potentially empty collection - throws `InvalidOperationException`. Use `FirstOrDefault()` and check for null/default.

```csharp
// BAD
var item = list.First(x => x.Id == 999); // Throws if not found!

// GOOD
var item = list.FirstOrDefault(x => x.Id == 999);
if (item != null) { /* use item */ }
```

---

### Any() vs Count() > 0

Check if collection has matching elements. Use `Any()` for just checking existence. Use `Count()` when you need actual count.

**Time Complexity**: `Any()` O(1) best case (short-circuits), O(n) worst case. `Count()` O(n) - must count all.

**Common Mistakes**: Using `Count() > 0` when `Any()` would short-circuit. `Any()` stops at first match, `Count()` counts all.

```csharp
// BAD - O(n) even if first element matches
if (collection.Count(x => x.IsActive) > 0) { }

// GOOD - O(1) if first element matches
if (collection.Any(x => x.IsActive)) { }
```

---

### OrderBy() / OrderByDescending()

Sorts collection. Use for sorting data for display or preparing for binary search.

**Time Complexity**: O(n log n) - uses stable sort algorithm.

**Common Mistakes**: Sorting when not needed (performance hit). Multiple sorts when one with `ThenBy()` would work.

---

### Distinct()

Removes duplicates. Use for getting unique values.

**Time Complexity**: O(n) - uses hash set internally.

**Common Mistakes**: Using on large collections without considering memory.

---

### Take() / Skip()

Pagination, limiting results. Use for pagination or getting top N items.

**Time Complexity**: O(n) where n is number to take/skip.

**Common Mistakes**: Using on unindexed database queries (should use database pagination).

---

## Async/Await: Deep Dive

### When to Use Async

Use for I/O operations (file, network, database), API calls, or long-running operations that don't block CPU. When NOT to use: CPU-bound work (use `Task.Run()` if needed), simple synchronous operations, or hot paths where overhead matters.

**Time Complexity**: Depends on operation, but doesn't block thread.

**Common Mistakes**: Using async for CPU-bound work without `Task.Run()`. Blocking on async with `.Result` or `.Wait()` - DEADLOCK RISK. `async void` except for event handlers.

```csharp
// BAD - Deadlock risk!
var result = GetDataAsync().Result;

// GOOD
var result = await GetDataAsync();
```

---

### Task.WhenAll() - Parallel Execution

Runs multiple async operations in parallel. Use for independent async operations that can run simultaneously.

**Time Complexity**: Time of longest operation (parallel), not sum.

**Common Mistakes**: Using sequential `await` when operations are independent. Not handling exceptions properly (one failure fails all).

```csharp
// BAD - Sequential, slow
var users = await GetUsersAsync();
var orders = await GetOrdersAsync();
var products = await GetProductsAsync();
// Total time = time1 + time2 + time3

// GOOD - Parallel, fast
var userTask = GetUsersAsync();
var orderTask = GetOrdersAsync();
var productTask = GetProductsAsync();
await Task.WhenAll(userTask, orderTask, productTask);
// Total time = max(time1, time2, time3)
```

---

### ValueTask vs Task

`Task<T>` always allocates on heap. `ValueTask<T>` is a struct with no allocation if synchronous completion. Use ValueTask for high-frequency methods, methods that often complete synchronously (cache hits), or performance-critical paths.

**Time Complexity**: Same, but ValueTask reduces GC pressure.

**Common Mistakes**: Using ValueTask everywhere (overhead for infrequent calls). Awaiting ValueTask multiple times (can only await once).

```csharp
// GOOD - ValueTask for cache scenario
public async ValueTask<string> GetDataAsync(string key) {
    if (cache.TryGetValue(key, out var value))
        return value; // No allocation!
    return await FetchFromDbAsync(key);
}
```

---

## Modern C# Features

### Records

Immutable reference type with value-based equality. Use for DTOs, value objects, or immutable data.

**Time Complexity**: Equality check is O(n) where n is number of properties.

**Common Mistakes**: Using records when you need mutability. Not understanding value-based equality vs reference equality.

```csharp
public record Person(string Name, int Age);

var p1 = new Person("Alice", 30);
var p2 = new Person("Alice", 30);
Console.WriteLine(p1 == p2); // True (value equality)

var p3 = p1 with { Age = 31 }; // Non-destructive mutation
```

---

### Pattern Matching

Modern way to check types and values. Use for replacing if-else chains or type checking.

**Time Complexity**: O(1) for type checks.

**Common Mistakes**: Overusing when simple if-else would work. Not handling all cases in switch expressions.

```csharp
// Property pattern
if (obj is Person { Age: > 18, Name: "Alice" }) { }

// Switch expression
var result = value switch {
    > 0 and < 10 => "single digit",
    >= 10 and < 100 => "double digit",
    _ => "other"
};
```

---

## Common Gotchas & Mistakes

### String Immutability

**Mistake**: Forgetting strings are immutable

```csharp
string s = "Hello";
s.ToUpper(); // WRONG! Returns new string, doesn't modify s
s = s.ToUpper(); // CORRECT!
```

**Time Complexity**: String operations create new strings (O(n) where n is length)

---

### Integer Division

**Mistake**: Forgetting integer division truncates

```csharp
int result = 7 / 2; // Result: 3 (not 3.5!)
double result = 7.0 / 2; // Result: 3.5
```

---

### Collection Modification During Iteration

**Mistake**: Modifying collection while iterating

```csharp
// BAD - Throws InvalidOperationException
foreach (var item in list) {
    if (item.ShouldRemove) {
        list.Remove(item); // Exception!
    }
}

// GOOD - Use RemoveAll or iterate backwards
list.RemoveAll(x => x.ShouldRemove);
```

**Time Complexity**: O(n) for RemoveAll, O(n^2) if done incorrectly

---

### Null Reference

**Mistake**: Accessing members on null

```csharp
string name = null;
int length = name.Length; // NullReferenceException!

// GOOD - Null-conditional operator
int? length = name?.Length; // Returns null if name is null
string result = name ?? "Default"; // Null-coalescing
```

---

## Performance Comparison Table

| Operation       | List<T>        | Dictionary<K,V> | HashSet<T> | Queue<T> | Stack<T> |
| --------------- | -------------- | --------------- | ---------- | -------- | -------- |
| Add             | O(1) amortized | O(1)            | O(1)       | O(1)     | O(1)     |
| Remove          | O(n)           | O(1)            | O(1)       | O(1)     | O(1)     |
| Contains        | O(n)           | O(1)            | O(1)       | O(n)     | O(n)     |
| Access by Index | O(1)           | N/A             | N/A        | N/A      | N/A      |
| Access by Key   | N/A            | O(1)            | N/A        | N/A      | N/A      |

---

## Interview Strategy

### Time Management

- Allocate time based on question count
- Answer easy questions first
- Leave time for review
- Don't get stuck on difficult questions

### Question Types

1. **"BEST" questions**: Consider performance, maintainability, modern patterns
2. **Code output**: Trace step-by-step, watch for gotchas
3. **Efficiency**: Think about time complexity
4. **Debugging**: Look for common mistakes

### Elimination Strategy

- Eliminate obviously wrong answers first
- Look for common mistake patterns
- Trust your first instinct on recall questions
- Consider edge cases

---

## Last-Minute Memory Dump

**Collections:**

- List: Indexed access, O(1) access, O(n) search
- Dictionary: Key lookup, O(1) average
- HashSet: Unique items, O(1) Contains
- Queue: FIFO, O(1) Enqueue/Dequeue
- Stack: LIFO, O(1) Push/Pop

**LINQ:**

- Deferred execution - materialize with ToList() if needed multiple times
- Any() short-circuits, Count() doesn't
- First() throws if empty, FirstOrDefault() returns default

**Async:**

- Use await, never .Result or .Wait()
- Task.WhenAll() for parallel independent operations
- ValueTask for high-frequency sync-completing methods

**Common Mistakes:**

- String immutability (need reassign)
- Integer division (7/2 = 3)
- Modifying collection during iteration
- Multiple LINQ enumeration
- Blocking on async

---

_Good luck! Focus on understanding WHY, not just memorizing!_

