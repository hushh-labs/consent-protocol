# .NET Practice Scenarios

_30 Critical Questions with Comprehensive Explanations - Scenario-based practice for .NET interviews_

---

## Section 1: Performance & Efficiency (Questions 1-8)

### Question 1

You need to process a large file (500MB) line by line. Which approach is MOST efficient?

A) Read entire file into memory with `File.ReadAllText()`, then split by newline  
B) Use `File.ReadAllLines()` to get string array  
C) Use `File.ReadLines()` with yield return (lazy evaluation)  
D) Load into DataTable for processing

**Answer: C**  
\*Explanation: `File.ReadLines()` uses yield return for lazy evaluation, reading one line at a time without loading entire file into memory. A and B load entire file (memory intensive for 500MB). D is unnecessary overhead. Time Complexity: O(n) where n is number of lines, but processes one at a time. Space Complexity: O(1) - only one line in memory at a time. Common Mistake: Using `ReadAllLines()` for large files, causing memory issues. Best Practice: Always use `ReadLines()` for large files, `ReadAllLines()` only for small files.\_

---

### Question 2

Your API endpoint performs 3 database calls that don't depend on each other. Current code:

```csharp
var users = await GetUsersAsync();
var orders = await GetOrdersAsync();
var products = await GetProductsAsync();
```

What is the BEST way to optimize this?

A) Remove async/await and make synchronous calls  
B) Use `Task.WhenAll()` to run queries in parallel  
C) Cache all results permanently  
D) Combine into single database query with JOINS

**Answer: B**  
\*Explanation: `Task.WhenAll()` runs independent async operations in parallel, significantly reducing total time. A makes it slower and blocks thread. C may cause stale data. D might not be feasible if data is in different tables/databases. Time Complexity: Sequential O(time1 + time2 + time3), Parallel O(max(time1, time2, time3)). Common Mistake: Using sequential await when operations are independent. Best Practice: Use `Task.WhenAll()` for independent async operations.\_

**Correct Implementation**:

```csharp
var userTask = GetUsersAsync();
var orderTask = GetOrdersAsync();
var productTask = GetProductsAsync();

await Task.WhenAll(userTask, orderTask, productTask);

var users = await userTask;
var orders = await orderTask;
var products = await productTask;
```

---

### Question 3

You have a collection of 1 million records. You need to check if ANY record meets a condition. Which is MOST efficient?

A) `collection.Where(x => condition).Count() > 0`  
B) `collection.Any(x => condition)`  
C) `collection.FirstOrDefault(x => condition) != null`  
D) `collection.Count(x => condition) > 0`

**Answer: B**  
\*Explanation: `Any()` stops at first match (short-circuits), best case O(1). A, C, and D all continue processing even after finding a match. A and D are especially bad as they iterate entire collection. Time Complexity: `Any()` O(1) best case, O(n) worst case. `Count()` O(n) always. Common Mistake: Using `Count() > 0` when `Any()` would short-circuit. Best Practice: Use `Any()` for existence checks, `Count()` only when you need the count.\_

---

### Question 4

You're building a caching layer. Items are accessed very frequently and some are already in cache. What should your method return?

A) `Task<T>` - standard async return type  
B) `ValueTask<T>` - optimized for frequent sync completion  
C) `T` - synchronous method  
D) `Task<Task<T>>` - nested task

**Answer: B**  
\*Explanation: `ValueTask<T>` is a struct that avoids heap allocation when result is immediately available. Use for high-frequency methods that often complete synchronously (cache hits). Time Complexity: Same as `Task<T>`, but reduces GC pressure. Space Complexity: `Task<T>` always allocates ~100 bytes on heap, `ValueTask<T>` no allocation for sync completion. Why others are wrong: A always allocates Task object causing GC pressure, C can't handle async cache miss, D incorrect pattern. Common Mistake: Using `Task<T>` for high-frequency methods with sync paths. Best Practice: Use `ValueTask<T>` for methods that frequently complete synchronously.\_

```csharp
public async ValueTask<string> GetCachedDataAsync(string key) {
    if (cache.TryGetValue(key, out var value))
        return value; // No allocation!
    return await FetchFromDatabaseAsync(key); // Allocates only on cache miss
}
```

---

### Question 5

You need to concatenate user IDs for 10,000 users in a loop. Which performs BEST?

A) `string result = ""; foreach(var id in ids) result += id;`  
B) `var sb = new StringBuilder(); foreach(var id in ids) sb.Append(id); return sb.ToString();`  
C) `string.Join(",", ids)`  
D) `ids.Aggregate("", (current, id) => current + id)`

**Answer: C**  
\*Explanation: `string.Join()` is optimized specifically for joining collections. Time Complexity: A O(n^2) creates new string each iteration, B O(n) StringBuilder efficient, C O(n) optimized, D O(n^2) same as A. Space Complexity: A O(n^2) many intermediate strings, B O(n) StringBuilder buffer, C O(n) optimized, D O(n^2). Why others are wrong: A creates 10,000 intermediate strings extremely inefficient, B good but `string.Join()` more optimized, D same problem as A. Common Mistake: Using `+=` in loops causing quadratic time complexity. Best Practice: Use `string.Join()` for collections, `StringBuilder` for complex concatenation.\_

---

### Question 6

You need to check if a collection has items, then process all items. Current code:

```csharp
IEnumerable<int> numbers = GetExpensiveData();
if (numbers.Any()) {
    ProcessAll(numbers);
}
```

What's the problem?

A) Nothing wrong  
B) Query executes twice (once for Any, once in ProcessAll)  
C) Should use Count() instead of Any()  
D) Should use List instead of IEnumerable

**Answer: B**  
\*Explanation: LINQ deferred execution means query executes when enumerated. Current code executes query twice O(2n), fixed code executes once O(n). Space Complexity: O(n) to materialize but avoids re-execution. Why others are wrong: A query executes twice inefficient, C `Count()` worse must count all doesn't short-circuit, D partially correct but need to materialize first. Common Mistake: Multiple enumeration of deferred LINQ queries. Best Practice: Materialize with `ToList()` if enumerating multiple times.\_

**Fixed Code**:

```csharp
var numbers = GetExpensiveData().ToList(); // Materialize once
if (numbers.Count > 0) {
    ProcessAll(numbers); // Uses materialized list
}
```

---

### Question 7

You're reading from a file. Which approach is BEST?

A) `var content = File.ReadAllText("file.txt");`  
B) `using (var reader = new StreamReader("file.txt")) { var content = reader.ReadToEnd(); }`  
C) `var reader = new StreamReader("file.txt"); var content = reader.ReadToEnd();`  
D) `File.ReadAllText()` with try-catch

**Answer: B**  
\*Explanation: `using` statement ensures `Dispose()` is called, releasing file handle. A actually fine for simple cases `ReadAllText()` handles disposal internally, but B is more explicit. C doesn't dispose StreamReader file handle may remain open. D try-catch doesn't ensure disposal. Common Mistake: Not disposing file streams causing resource leaks. Best Practice: Always use `using` statement for `IDisposable` resources.\_

---

### Question 8

You need to safely get a value from a dictionary. Which is BEST?

A) `var value = dict[key];`  
B) `if (dict.ContainsKey(key)) { var value = dict[key]; }`  
C) `if (dict.TryGetValue(key, out var value)) { /* use value */ }`  
D) `var value = dict.GetValueOrDefault(key);`

**Answer: C**  
\*Explanation: `TryGetValue()` combines existence check and retrieval in one operation. Time Complexity: A O(1) but throws exception if key missing, B O(2) two hash lookups, C O(1) single hash lookup, D O(1) but returns default value might be confusing. Space Complexity: O(1) for all. Why others are wrong: A throws `KeyNotFoundException`, B double lookup inefficient, D returns default value which might be valid confusing. Common Mistake: Using `ContainsKey()` then `dict[key]` - double lookup. Best Practice: Always use `TryGetValue()` for safe lookups.\_

---

## Section 2: Code Analysis & Debugging (Questions 9-16)

### Question 9

What's the problem with this code?

```csharp
public async Task ProcessDataAsync() {
    var data = GetDataAsync().Result;
    await SaveDataAsync(data);
}
```

A) Missing try-catch block  
B) Using .Result can cause deadlock  
C) Should use ConfigureAwait(false)  
D) Nothing, code is correct

**Answer: B**  
\*Explanation: `.Result` blocks synchronously on async method - anti-pattern. In UI/ASP.NET there's synchronization context. `GetDataAsync()` needs context to continue. `.Result` blocks thread waiting for result. Context is blocked so async method can't complete - Deadlock! Time Complexity: Blocks thread can cause deadlock. Why others are wrong: A good practice but not main issue, C helps but doesn't fix blocking, D code will deadlock in UI/ASP.NET contexts. Common Mistake: Blocking on async with `.Result` or `.Wait()`. Best Practice: Always use `await`, never `.Result` or `.Wait()`.\_

**Fixed Code**:

```csharp
public async Task ProcessDataAsync() {
    var data = await GetDataAsync(); // Correct!
    await SaveDataAsync(data);
}
```

---

### Question 10

This code has a subtle bug. What's wrong?

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };
foreach (var num in numbers) {
    if (num % 2 == 0)
        numbers.Remove(num);
}
```

A) Nothing wrong  
B) Modifying collection while iterating causes exception  
C) Wrong condition - should be `num % 2 != 0`  
D) Should use for loop instead

**Answer: B**  
\*Explanation: `foreach` uses enumerator that becomes invalid when collection is modified. Throws `InvalidOperationException: Collection was modified; enumeration operation may not execute`. Enumerator maintains state, modification invalidates it. Why others are wrong: A will throw exception, C condition correct but problem is modification during iteration, D partially correct but need to iterate backwards. Common Mistake: Modifying collection in foreach loop. Best Practice: Use `RemoveAll()`, iterate backwards, or create new collection.\_

**Fixed Options**:

```csharp
// Option 1: RemoveAll (best for simple cases)
numbers.RemoveAll(n => n % 2 == 0);

// Option 2: Iterate backwards
for (int i = numbers.Count - 1; i >= 0; i--) {
    if (numbers[i] % 2 == 0)
        numbers.RemoveAt(i);
}

// Option 3: Create new collection
numbers = numbers.Where(n => n % 2 != 0).ToList();
```

---

### Question 11

Why might this code be problematic?

```csharp
public IEnumerable<User> GetActiveUsers() {
    var users = database.Users.Where(u => u.IsActive);
    LogCount(users.Count());
    return users;
}
```

A) Missing async/await  
B) Query executes twice (once for Count, once when enumerated)  
C) Should return List<User> not IEnumerable<User>  
D) Nothing wrong

**Answer: B**  
\*Explanation: LINQ deferred execution - query doesn't execute until enumerated. Current code executes query twice against database O(2n), fixed code executes once O(n). Two separate SQL queries executed. Why others are wrong: A not main issue though async would be better, C partially correct but need to materialize first, D query executes twice inefficient. Common Mistake: Multiple enumeration of deferred LINQ queries. Best Practice: Materialize with `ToList()` if enumerating multiple times.\_

**Fixed Code**:

```csharp
public IEnumerable<User> GetActiveUsers() {
    var users = database.Users.Where(u => u.IsActive).ToList(); // Materialize
    LogCount(users.Count); // O(1), no query
    return users; // Returns materialized list
}
```

---

### Question 12

What will this code output?

```csharp
string s = "hello";
s.ToUpper();
Console.WriteLine(s);
```

A) HELLO  
B) hello  
C) Null  
D) Compilation error

**Answer: B**  
\*Explanation: Strings are immutable - operations return new strings. `ToUpper()` returns new string but doesn't modify original. Time Complexity: O(n) where n is string length creates new string. Space Complexity: O(n) new string created. Why others are wrong: A would be correct if result assigned `s = s.ToUpper()`, C string not null, D code compiles fine. Common Mistake: Forgetting strings are immutable expecting modification. Best Practice: Always assign result of string operations.\_

**Fixed Code**:

```csharp
string s = "hello";
s = s.ToUpper(); // Assign the result!
Console.WriteLine(s); // HELLO
```

---

### Question 13

This caching implementation has a race condition. What's the issue?

```csharp
private Dictionary<string, object> cache = new Dictionary<string, object>();

public object GetOrAdd(string key, Func<object> factory) {
    if (!cache.ContainsKey(key)) {
        cache[key] = factory();
    }
    return cache[key];
}
```

A) Nothing wrong  
B) Not thread-safe - two threads can add same key simultaneously  
C) Should use List instead of Dictionary  
D) factory() might return null

**Answer: B**  
\*Explanation: Race condition - two threads can both pass check before either adds. Thread 1 checks `ContainsKey()` false, Thread 2 checks `ContainsKey()` false before Thread 1 adds, both threads add to dictionary - potential issues. Time Complexity: Same but thread-safety issue. Why others are wrong: A not thread-safe, C List doesn't solve problem, D not main issue. Common Mistake: Not considering thread safety in shared state. Best Practice: Use `ConcurrentDictionary` or locking for thread-safe operations.\_

**Fixed Code**:

```csharp
private ConcurrentDictionary<string, object> cache = new ConcurrentDictionary<string, object>();

public object GetOrAdd(string key, Func<object> factory) {
    return cache.GetOrAdd(key, _ => factory()); // Thread-safe!
}
```

---

### Question 14

What is the result of: `int result = 7 / 2;`

A) 3.5  
B) 3  
C) 4  
D) Compilation error

**Answer: B**  
\*Explanation: Integer division truncates decimal part. Both operands are int so result is int truncated. Time Complexity: O(1). Why others are wrong: A would be correct for `double result = 7.0 / 2`, C rounds up but integer division truncates, D code compiles fine. Common Mistake: Expecting decimal result from integer division. Best Practice: Use `7.0 / 2` or `(double)7 / 2` for decimal result.\_

---

### Question 15

What will this code do?

```csharp
string name = null;
int length = name.Length;
```

A) length = 0  
B) length = null  
C) Throws NullReferenceException  
D) Compilation error

**Answer: C**  
\*Explanation: Accessing member on null reference throws `NullReferenceException`. Why others are wrong: A length doesn't default to 0 for null, B int can't be null unless nullable, D code compiles runtime exception. Common Mistake: Not checking for null before accessing members. Best Practice: Use null-conditional operator `name?.Length`.\_

**Safe Code**:

```csharp
string name = null;
int? length = name?.Length; // Returns null if name is null
int safeLength = name?.Length ?? 0; // Returns 0 if null
```

---

### Question 16

What will this code output?

```csharp
var list1 = new List<int> { 1, 2, 3 };
var list2 = list1;
list2.Add(4);
Console.WriteLine(list1.Count);
```

A) 3  
B) 4  
C) Compilation error  
D) Runtime error

**Answer: B**  
_Explanation: List is reference type - both variables reference same object. `list2 = list1` copies reference not the list itself. Time Complexity: O(1) for Add. Why others are wrong: A would be correct if List was value type it's not, C code compiles fine, D no runtime error. Common Mistake: Expecting value type behavior from reference types. Best Practice: Understand that classes are reference types, structs are value types._

---

## Section 3: Architecture & Design Patterns (Questions 17-22)

### Question 17

You need to ensure only ONE instance of a configuration manager exists in your application. Which pattern is MOST appropriate?

A) Factory Pattern  
B) Singleton Pattern  
C) Repository Pattern  
D) Observer Pattern

**Answer: B**  
_Explanation: Singleton ensures exactly one instance exists globally. Use for configuration managers, loggers, caches that should be shared. Time Complexity: O(1) access. Space Complexity: O(1) single instance. Why others are wrong: A Factory creates objects doesn't ensure single instance, C Repository abstracts data access not instance management, D Observer handles notifications not instance control. Common Mistake: Overusing Singleton when not needed. Best Practice: Use Singleton sparingly, prefer dependency injection._

**Thread-Safe Implementation**:

```csharp
public sealed class ConfigManager {
    private static readonly Lazy<ConfigManager> instance =
        new Lazy<ConfigManager>(() => new ConfigManager());

    private ConfigManager() { }

    public static ConfigManager Instance => instance.Value;
}
```

---

### Question 18

Your application needs to create different types of notification senders (Email, SMS, Push) based on user preference. Which pattern is BEST?

A) Singleton Pattern  
B) Factory Pattern  
C) Builder Pattern  
D) Prototype Pattern

**Answer: B**  
\*Explanation: Factory creates objects without specifying exact class. Use for creating different implementations based on runtime conditions. Time Complexity: O(1) simple object creation. Why others are wrong: A Singleton ensures one instance not object creation, C Builder constructs complex objects step-by-step, D Prototype clones existing objects. Common Mistake: Using if-else chains instead of Factory pattern. Best Practice: Use Factory to centralize object creation logic.\_

**Implementation**:

```csharp
public interface INotificationSender {
    void Send(string message);
}

public class NotificationFactory {
    public INotificationSender Create(NotificationType type) {
        return type switch {
            NotificationType.Email => new EmailSender(),
            NotificationType.SMS => new SmsSender(),
            NotificationType.Push => new PushNotificationSender(),
            _ => throw new ArgumentException()
        };
    }
}
```

---

### Question 19

You're building a data access layer for multiple entity types. Which pattern provides the BEST abstraction?

A) Singleton Pattern  
B) Factory Pattern  
C) Repository Pattern  
D) Decorator Pattern

**Answer: C**  
\*Explanation: Repository abstracts data access logic. Use for separating business logic from data access, enabling unit testing. Time Complexity: Depends on implementation. Why others are wrong: A Singleton manages instances not data access, B Factory creates objects not data access abstraction, D Decorator adds behavior not data access. Common Mistake: Mixing data access logic with business logic. Best Practice: Use Repository to abstract data access, enable mocking for tests.\_

**Implementation**:

```csharp
public interface IRepository<T> {
    T GetById(int id);
    IEnumerable<T> GetAll();
    void Add(T entity);
    void Update(T entity);
    void Delete(int id);
}
```

---

### Question 20

You need to add caching behavior to an existing service without modifying its code. Which pattern is MOST appropriate?

A) Adapter Pattern  
B) Decorator Pattern  
C) Proxy Pattern  
D) Bridge Pattern

**Answer: B**  
\*Explanation: Decorator wraps object and adds behavior. Use for adding cross-cutting concerns (caching, logging, validation) without modifying original. Time Complexity: O(1) for cache hit, depends on inner service for cache miss. Why others are wrong: A Adapter changes interface not adds behavior, C Proxy controls access similar but Decorator more flexible, D Bridge separates abstraction from implementation. Common Mistake: Modifying existing classes instead of using Decorator. Best Practice: Use Decorator for adding behavior, keeps original class clean.\_

**Implementation**:

```csharp
public interface IDataService {
    string GetData(string key);
}

public class CachingDecorator : IDataService {
    private readonly IDataService _inner;
    private readonly ICache _cache;

    public CachingDecorator(IDataService inner, ICache cache) {
        _inner = inner;
        _cache = cache;
    }

    public string GetData(string key) {
        if (_cache.TryGet(key, out string cached))
            return cached;

        var data = _inner.GetData(key);
        _cache.Set(key, data);
        return data;
    }
}
```

---

### Question 21

Your application sends domain events when entities change. Which pattern is this?

A) Command Pattern  
B) Observer Pattern  
C) Strategy Pattern  
D) Mediator Pattern

**Answer: B**  
_Explanation: Observer (Pub/Sub) notifies multiple objects of state changes. Use for event-driven architectures, domain events, UI updates. Time Complexity: O(n) where n is number of observers. Why others are wrong: A Command encapsulates requests not notifications, C Strategy selects algorithm not notifications, D Mediator centralizes communication different from Observer. Common Mistake: Tight coupling between publisher and subscribers. Best Practice: Use events/delegates for Observer pattern in .NET._

---

### Question 22

You need to apply different discount calculation strategies based on customer type. Which pattern is BEST?

A) Factory Pattern  
B) Strategy Pattern  
C) Template Method Pattern  
D) Command Pattern

**Answer: B**  
_Explanation: Strategy defines family of algorithms, makes them interchangeable. Use for different algorithms for same operation based on context. Time Complexity: Depends on algorithm. Why others are wrong: A Factory creates objects Strategy selects algorithms, C Template Method defines skeleton subclasses fill steps, D Command encapsulates requests not algorithms. Common Mistake: Using if-else chains instead of Strategy pattern. Best Practice: Use Strategy to make algorithms interchangeable._

---

## Section 4: Modern C# & Best Practices (Questions 23-30)

### Question 23

You need an immutable data transfer object with value-based equality. What's the BEST modern C# approach?

A) Class with readonly fields  
B) Struct with properties  
C) Record type  
D) Sealed class with private setters

**Answer: C**  
\*Explanation: Records are immutable reference types with value-based equality. Use for DTOs, value objects, immutable data structures. Time Complexity: Equality check O(n) where n is number of properties. Space Complexity: Same as class. Why others are wrong: A works but verbose no built-in value equality, B structs are value types may have performance issues if large, D works but verbose no built-in value equality. Common Mistake: Using classes when records would be better. Best Practice: Use records for immutable DTOs.\_

**Example**:

```csharp
public record PersonDto(string Name, int Age);

var p1 = new PersonDto("Alice", 30);
var p2 = new PersonDto("Alice", 30);
Console.WriteLine(p1 == p2); // True (value equality)

var p3 = p1 with { Age = 31 }; // Non-destructive mutation
```

---

### Question 24

This code uses which modern C# feature?

```csharp
var result = value switch {
    > 0 and < 10 => "single digit",
    >= 10 and < 100 => "double digit",
    _ => "other"
};
```

A) Pattern matching with switch expression  
B) Ternary operator  
C) If-else statement  
D) Dictionary lookup

**Answer: A**  
\*Explanation: Switch expression with relational and logical patterns. Use for replacing if-else chains, type/value checking. Time Complexity: O(1) constant time pattern matching. Why others are wrong: B ternary is `condition ? true : false` not switch, C if-else different syntax, D dictionary lookup different mechanism. Common Mistake: Using verbose if-else when switch expression would be cleaner. Best Practice: Use switch expressions for multiple conditions.\_

---

### Question 25

What's the advantage of this C# 11 feature?

```csharp
public class User {
    public required string Name { get; init; }
    public int Age { get; init; }
}
```

A) Better performance  
B) Compile-time enforcement that Name must be set  
C) Allows Name to be changed after initialization  
D) Reduces memory usage

**Answer: B**  
\*Explanation: `required` keyword enforces property must be set during initialization. Use for ensuring critical properties are always set. Time Complexity: No runtime impact, compile-time check. Why others are wrong: A no performance difference, C `init` prevents changes after initialization, D no memory difference. Common Mistake: Forgetting to set required properties. Best Practice: Use `required` for critical properties that must be set.\_

---

### Question 26

When should you use `ValueTask<T>` instead of `Task<T>`?

A) Always, it's always better  
B) For methods that may complete synchronously (like cache hits)  
C) For long-running operations  
D) Never, Task is always sufficient

**Answer: B**  
\*Explanation: `ValueTask<T>` avoids heap allocation for sync completion. Use for high-frequency methods that often complete synchronously. Time Complexity: Same but reduces GC pressure. Space Complexity: No allocation for sync path. Why others are wrong: A not always better has overhead for infrequent calls, C long-running operations always async Task is fine, D ValueTask has benefits for specific scenarios. Common Mistake: Using Task for high-frequency sync-completing methods. Best Practice: Use ValueTask for methods that frequently complete synchronously.\_

---

### Question 27

What does `string?` indicate in C# 8+?

A) The string can be null  
B) The string cannot be null  
C) The string is always null  
D) Compilation error

**Answer: A**  
\*Explanation: Nullable reference type annotation. `string?` explicitly marks reference types that can be null. Time Complexity: No runtime impact, compile-time check. Why others are wrong: B that would be `string` non-nullable, C not always null just can be null, D valid syntax in C# 8+ with nullable context enabled. Common Mistake: Not using nullable annotations, missing null checks. Best Practice: Enable nullable reference types and use annotations.\_

---

### Question 28

What can you do with this property?

```csharp
public class Person {
    public string Name { get; init; }
}
```

A) Set it only during object initialization  
B) Set it anytime  
C) Never set it  
D) Only read it

**Answer: A**  
\*Explanation: `init` accessor allows setting only during object initialization. Use for immutable properties that are set once. Time Complexity: No difference. Why others are wrong: B can't set after initialization, C can be set during initialization, D can be set during initialization. Common Mistake: Trying to set init-only property after initialization. Best Practice: Use `init` for properties that should be immutable after creation.\_

---

### Question 29

You're processing 100MB of text data. Memory usage is critical. Which approach is MOST memory-efficient?

A) `string[] lines = File.ReadAllLines(path);`  
B) `string content = File.ReadAllText(path);`  
C) `IEnumerable<string> lines = File.ReadLines(path);`  
D) `byte[] data = File.ReadAllBytes(path);`

**Answer: C**  
\*Explanation: `ReadLines()` uses lazy evaluation, one line at a time. Use for processing large files without loading entire file. Time Complexity: O(n) where n is lines but processes incrementally. Space Complexity: O(1) only one line in memory. Why others are wrong: A loads all lines into memory O(n) space, B loads entire file O(n) space, D loads entire file as bytes O(n) space. Common Mistake: Using `ReadAllLines()` for large files. Best Practice: Always use `ReadLines()` for large files.\_

---

### Question 30

You need to build a string from 1000 items. Which is MOST efficient?

A) `string result = ""; for (int i = 0; i < 1000; i++) result += items[i];`  
B) `var sb = new StringBuilder(); for (int i = 0; i < 1000; i++) sb.Append(items[i]); return sb.ToString();`  
C) `string.Join("", items)`  
D) `items.Aggregate("", (acc, item) => acc + item)`

**Answer: C**  
\*Explanation: `string.Join()` is optimized for joining collections. Time Complexity: A O(n^2) creates many intermediate strings, B O(n) StringBuilder efficient, C O(n) optimized, D O(n^2) string concatenation in Aggregate. Space Complexity: A O(n^2) many intermediate strings, B O(n) StringBuilder buffer, C O(n) optimized, D O(n^2). Why others are wrong: A quadratic time complexity very inefficient, B good but `string.Join()` more optimized for this case, D same problem as A. Common Mistake: Using `+=` in loops. Best Practice: Use `string.Join()` for collections, `StringBuilder` for complex concatenation.\_

---

## Answer Key Summary

Performance & Efficiency: 1.C, 2.B, 3.B, 4.B, 5.C, 6.B, 7.B, 8.C  
Code Analysis & Debugging: 9.B, 10.B, 11.B, 12.B, 13.B, 14.B, 15.C, 16.B  
Architecture & Design: 17.B, 18.B, 19.C, 20.B, 21.B, 22.B  
Modern C# & Best Practices: 23.C, 24.A, 25.B, 26.B, 27.A, 28.A, 29.C, 30.C

---

## Key Takeaways

1. Performance: Always consider time/space complexity, use appropriate collections
2. LINQ: Understand deferred execution, materialize when needed multiple times
3. Async: Never use `.Result` or `.Wait()`, use `Task.WhenAll()` for parallel operations
4. Collections: Choose right collection for the use case (List vs Dictionary vs HashSet)
5. Modern C#: Use records for DTOs, pattern matching for conditionals, ValueTask for high-frequency methods
6. Common Mistakes: String immutability, collection modification during iteration, multiple LINQ enumeration

Focus on understanding WHY each answer is correct, not just memorizing!
