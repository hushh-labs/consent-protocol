# Architecture & Design Patterns Study Guide

_Comprehensive Reference for .NET Interviews_

---

## Introduction

This guide covers all design patterns commonly tested in .NET interviews. Each pattern includes practical C# examples, use cases, common mistakes, and interview-specific tips.

**Interview Focus**: Questions typically ask you to identify which pattern is MOST appropriate for a given scenario, or recognize pattern implementations in code.

---

## Pattern Categories Overview

**Creational Patterns**: Control object creation

- Singleton, Factory, Builder, Prototype

**Structural Patterns**: Compose objects into larger structures

- Decorator, Adapter, Proxy, Repository

**Behavioral Patterns**: Define communication between objects

- Observer, Strategy, Command, Template Method, Mediator

---

## Creational Patterns

### 1. Singleton Pattern

**Quick Definition**: Ensures a class has only one instance and provides global access to it.

**Problem It Solves**: When you need exactly one instance of a class (configuration manager, logger, cache) that should be shared across the application.

**Solution**: Private constructor prevents external instantiation. Static property/method provides access to single instance.

**C# Implementation**:

```csharp
// Thread-safe Singleton using Lazy<T>
public sealed class ConfigManager
{
    private static readonly Lazy<ConfigManager> instance =
        new Lazy<ConfigManager>(() => new ConfigManager());

    private ConfigManager() { } // Private constructor

    public static ConfigManager Instance => instance.Value;

    public string GetSetting(string key) { /* ... */ }
}

// Usage
var config = ConfigManager.Instance;
var value = config.GetSetting("ApiKey");
```

**When to Use**:

- Configuration managers
- Loggers
- Caches that should be shared
- Database connection pools
- When exactly one instance must exist

**When NOT to Use**:

- When you need multiple instances
- When you need to test with mocks (hard to test)
- For simple utility classes (prefer static methods)
- When dependency injection is available (prefer DI)

**Common Mistakes**:

- Not making it thread-safe (multiple threads can create multiple instances)
- Overusing Singleton (makes code hard to test)
- Using Singleton when dependency injection would be better
- Not using `Lazy<T>` for lazy initialization

**Best Practices**:

- Use `Lazy<T>` for thread-safe lazy initialization
- Make class `sealed` to prevent inheritance
- Consider using dependency injection instead
- Use sparingly - prefer dependency injection in modern .NET

**Interview Tips**:

- Questions often show scenarios like "ensure only ONE instance exists"
- Look for keywords: "single instance", "shared", "global access"
- Thread-safe implementation is often the correct answer
- May ask about alternatives (dependency injection)

---

### 2. Factory Pattern

**Quick Definition**: Creates objects without specifying the exact class of object that will be created.

**Problem It Solves**: When you need to create objects based on runtime conditions, and you want to centralize object creation logic.

**Solution**: Factory class/method encapsulates object creation logic. Client code calls factory method instead of constructors directly.

**C# Implementation**:

```csharp
// Interface
public interface INotificationSender
{
    void Send(string message);
}

// Implementations
public class EmailSender : INotificationSender
{
    public void Send(string message) { /* Send email */ }
}

public class SmsSender : INotificationSender
{
    public void Send(string message) { /* Send SMS */ }
}

public class PushNotificationSender : INotificationSender
{
    public void Send(string message) { /* Send push */ }
}

// Factory
public class NotificationFactory
{
    public INotificationSender Create(NotificationType type)
    {
        return type switch
        {
            NotificationType.Email => new EmailSender(),
            NotificationType.SMS => new SmsSender(),
            NotificationType.Push => new PushNotificationSender(),
            _ => throw new ArgumentException($"Unknown type: {type}")
        };
    }
}

// Usage
var factory = new NotificationFactory();
var sender = factory.Create(NotificationType.Email);
sender.Send("Hello");
```

**When to Use**:

- Creating different types of objects based on runtime conditions
- When object creation logic is complex
- When you want to centralize object creation
- When you want to decouple client code from concrete classes

**When NOT to Use**:

- When object creation is simple (just use `new`)
- When you only have one type to create
- When dependency injection handles creation

**Common Mistakes**:

- Using if-else chains instead of Factory pattern
- Factory method returns concrete types instead of interfaces
- Not handling unknown types (should throw exception)

**Best Practices**:

- Return interfaces, not concrete types
- Use switch expressions (C# 8+) for cleaner code
- Handle unknown types with exceptions
- Consider using dependency injection for complex scenarios

**Interview Tips**:

- Look for scenarios: "create different types based on condition"
- Keywords: "based on user preference", "different implementations"
- Factory creates objects, doesn't ensure single instance (that's Singleton)
- May show code with if-else chains asking for better approach

---

### 3. Builder Pattern

**Quick Definition**: Constructs complex objects step by step, allowing different representations of the same construction process.

**Problem It Solves**: When object construction is complex with many optional parameters, or when you want to construct objects step-by-step.

**Solution**: Builder class handles object construction. Provides fluent interface for setting properties. `Build()` method returns final object.

**C# Implementation**:

```csharp
public class User
{
    public string Name { get; set; }
    public string Email { get; set; }
    public int Age { get; set; }
    public string Address { get; set; }
    public string Phone { get; set; }
}

public class UserBuilder
{
    private User _user = new User();

    public UserBuilder WithName(string name)
    {
        _user.Name = name;
        return this;
    }

    public UserBuilder WithEmail(string email)
    {
        _user.Email = email;
        return this;
    }

    public UserBuilder WithAge(int age)
    {
        _user.Age = age;
        return this;
    }

    public User Build()
    {
        // Validation
        if (string.IsNullOrEmpty(_user.Name))
            throw new InvalidOperationException("Name is required");

        return _user;
    }
}

// Usage
var user = new UserBuilder()
    .WithName("Alice")
    .WithEmail("alice@example.com")
    .WithAge(30)
    .Build();
```

**When to Use**:

- Complex object construction with many optional parameters
- When you want to construct objects step-by-step
- When you need different representations of same object
- When constructor has too many parameters

**When NOT to Use**:

- Simple object construction (just use constructor)
- When all parameters are required (use constructor)
- When object initializers are sufficient

**Common Mistakes**:

- Not returning `this` from builder methods (breaks fluent interface)
- Not validating in `Build()` method
- Creating builder for simple objects

**Best Practices**:

- Return `this` for fluent interface
- Validate in `Build()` method
- Make builder methods return builder instance
- Consider using object initializers for simple cases

**Interview Tips**:

- Look for scenarios with many optional parameters
- Keywords: "step by step", "complex construction", "fluent interface"
- Builder constructs objects, Factory creates different types
- May show code with many constructor parameters asking for better approach

---

### 4. Prototype Pattern

**Quick Definition**: Creates new objects by copying/cloning existing instances rather than creating from scratch.

**Problem It Solves**: When object creation is expensive, or when you want to create objects that are similar to existing ones.

**Solution**: Implement `ICloneable` or provide `Clone()` method. Create new instances by copying existing ones.

**C# Implementation**:

```csharp
public class User : ICloneable
{
    public string Name { get; set; }
    public string Email { get; set; }
    public List<string> Permissions { get; set; }

    public object Clone()
    {
        return new User
        {
            Name = this.Name,
            Email = this.Email,
            Permissions = new List<string>(this.Permissions) // Deep copy
        };
    }

    // Or use MemberwiseClone for shallow copy
    public User ShallowClone()
    {
        return (User)this.MemberwiseClone();
    }
}

// Usage
var original = new User { Name = "Alice", Email = "alice@example.com" };
var clone = (User)original.Clone();
```

**When to Use**:

- When object creation is expensive
- When you need objects similar to existing ones
- When you want to avoid subclassing for object creation
- When classes are loaded at runtime

**When NOT to Use**:

- When object creation is simple and cheap
- When objects have circular references (complex cloning)
- When deep copying is not needed

**Common Mistakes**:

- Shallow copy when deep copy is needed (shared references)
- Not implementing `ICloneable` correctly
- Cloning objects with circular references

**Best Practices**:

- Prefer deep copy for complex objects
- Consider using serialization for deep cloning
- Document whether clone is shallow or deep
- Use `MemberwiseClone()` for shallow copy of value types

**Interview Tips**:

- Look for scenarios: "copy existing object", "expensive creation"
- Keywords: "clone", "copy", "similar to existing"
- May ask about shallow vs deep copy
- Less common in assessments but good to know

---

## Structural Patterns

### 5. Decorator Pattern

**Quick Definition**: Adds behavior to objects dynamically without modifying their structure.

**Problem It Solves**: When you need to add functionality (caching, logging, validation) to objects without modifying their code or creating subclasses.

**Solution**: Create decorator class that wraps original object. Decorator implements same interface and delegates to wrapped object, adding behavior before/after.

**C# Implementation**:

```csharp
// Interface
public interface IDataService
{
    string GetData(string key);
}

// Original implementation
public class DatabaseService : IDataService
{
    public string GetData(string key)
    {
        // Expensive database call
        return $"Data for {key}";
    }
}

// Decorator - adds caching
public class CachingDecorator : IDataService
{
    private readonly IDataService _inner;
    private readonly Dictionary<string, string> _cache = new();

    public CachingDecorator(IDataService inner)
    {
        _inner = inner;
    }

    public string GetData(string key)
    {
        // Check cache first
        if (_cache.TryGetValue(key, out string cached))
            return cached;

        // Call inner service
        var data = _inner.GetData(key);

        // Cache result
        _cache[key] = data;
        return data;
    }
}

// Another decorator - adds logging
public class LoggingDecorator : IDataService
{
    private readonly IDataService _inner;

    public LoggingDecorator(IDataService inner)
    {
        _inner = inner;
    }

    public string GetData(string key)
    {
        Console.WriteLine($"Getting data for key: {key}");
        var result = _inner.GetData(key);
        Console.WriteLine($"Retrieved: {result}");
        return result;
    }
}

// Usage - can chain decorators
IDataService service = new DatabaseService();
service = new CachingDecorator(service);
service = new LoggingDecorator(service);

var data = service.GetData("user123");
```

**When to Use**:

- Adding cross-cutting concerns (caching, logging, validation)
- When you can't modify original class
- When you need to add/remove behavior at runtime
- When subclassing would create too many classes

**When NOT to Use**:

- When you can modify original class directly
- When behavior is core to the class (should be in class)
- When decorators become too complex

**Common Mistakes**:

- Modifying original class instead of using decorator
- Not implementing same interface as wrapped object
- Creating too many decorator layers (complexity)

**Best Practices**:

- Decorator should implement same interface as wrapped object
- Can chain multiple decorators
- Keep decorators focused on single responsibility
- Consider using dependency injection for decorators

**Interview Tips**:

- Look for scenarios: "add behavior without modifying code"
- Keywords: "wrapping", "adds functionality", "without changing original"
- Decorator adds behavior, Adapter changes interface
- May show code asking which pattern adds caching/logging

---

### 6. Adapter Pattern

**Quick Definition**: Allows incompatible interfaces to work together by wrapping one interface with another.

**Problem It Solves**: When you have existing code with one interface, but need to use it with code expecting a different interface.

**Solution**: Create adapter class that implements target interface and wraps adaptee. Adapter translates calls between interfaces.

**C# Implementation**:

```csharp
// Target interface (what client expects)
public interface ILogger
{
    void Log(string message);
}

// Adaptee (existing class with different interface)
public class ThirdPartyLogger
{
    public void WriteLog(string msg, int level)
    {
        Console.WriteLine($"[Level {level}] {msg}");
    }
}

// Adapter
public class LoggerAdapter : ILogger
{
    private readonly ThirdPartyLogger _adaptee;

    public LoggerAdapter(ThirdPartyLogger adaptee)
    {
        _adaptee = adaptee;
    }

    public void Log(string message)
    {
        // Adapt the interface
        _adaptee.WriteLog(message, 1);
    }
}

// Usage
ILogger logger = new LoggerAdapter(new ThirdPartyLogger());
logger.Log("Hello"); // Works with ILogger interface
```

**When to Use**:

- Integrating third-party libraries with different interfaces
- Making legacy code work with new code
- When you can't modify existing interfaces
- Wrapping incompatible APIs

**When NOT to Use**:

- When you can modify interfaces directly
- When interfaces are already compatible
- When you need to add new behavior (use Decorator)

**Common Mistakes**:

- Confusing with Decorator (Adapter changes interface, Decorator adds behavior)
- Creating adapter when interface modification is possible
- Making adapter too complex

**Best Practices**:

- Keep adapter simple - just translate interface
- Adapter should not add new behavior (that's Decorator)
- Consider using dependency injection
- Document what interface is being adapted

**Interview Tips**:

- Look for scenarios: "incompatible interfaces", "third-party library"
- Keywords: "wrapping", "make work together", "different interface"
- Adapter changes interface, Decorator adds behavior
- May show code with incompatible interfaces asking for solution

---

### 7. Proxy Pattern

**Quick Definition**: Provides a placeholder or surrogate for another object to control access to it.

**Problem It Solves**: When you need to control access to an object (lazy loading, access control, logging) without changing the object itself.

**Solution**: Create proxy class that implements same interface as real object. Proxy controls access and delegates to real object when needed.

**C# Implementation**:

```csharp
// Interface
public interface IImage
{
    void Display();
}

// Real object (expensive to create)
public class RealImage : IImage
{
    private string _filename;

    public RealImage(string filename)
    {
        _filename = filename;
        LoadFromDisk(); // Expensive operation
    }

    private void LoadFromDisk()
    {
        Console.WriteLine($"Loading {_filename} from disk...");
    }

    public void Display()
    {
        Console.WriteLine($"Displaying {_filename}");
    }
}

// Proxy - lazy loading
public class ProxyImage : IImage
{
    private RealImage _realImage;
    private string _filename;

    public ProxyImage(string filename)
    {
        _filename = filename;
        // Don't create RealImage yet
    }

    public void Display()
    {
        // Create RealImage only when needed (lazy loading)
        if (_realImage == null)
            _realImage = new RealImage(_filename);

        _realImage.Display();
    }
}

// Usage
IImage image = new ProxyImage("photo.jpg");
// RealImage not created yet
image.Display(); // Now RealImage is created
```

**When to Use**:

- Lazy loading (create object only when needed)
- Access control (check permissions before access)
- Remote proxies (access remote objects)
- Virtual proxies (create expensive objects on demand)

**When NOT to Use**:

- When you don't need to control access
- When object creation is cheap
- When you can modify original object directly

**Common Mistakes**:

- Confusing with Decorator (Proxy controls access, Decorator adds behavior)
- Creating proxy when not needed
- Proxy becoming too complex

**Best Practices**:

- Proxy should implement same interface as real object
- Keep proxy focused on access control
- Consider using `Lazy<T>` for simple lazy loading scenarios
- Document what the proxy is controlling

**Interview Tips**:

- Look for scenarios: "lazy loading", "access control", "on demand"
- Keywords: "placeholder", "control access", "defer creation"
- Proxy controls access, Decorator adds behavior
- May show code asking which pattern implements lazy loading

---

### 8. Repository Pattern

**Quick Definition**: Abstracts data access logic, providing a collection-like interface for accessing domain objects.

**Problem It Solves**: Separates business logic from data access logic. Makes code testable by allowing mock repositories. Provides consistent data access interface.

**Solution**: Create repository interface with common data operations. Implement repository for specific data sources. Business logic uses repository interface, not data access directly.

**C# Implementation**:

```csharp
// Domain entity
public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
}

// Repository interface
public interface IUserRepository
{
    User GetById(int id);
    IEnumerable<User> GetAll();
    void Add(User user);
    void Update(User user);
    void Delete(int id);
    IEnumerable<User> FindByEmail(string email);
}

// Implementation
public class UserRepository : IUserRepository
{
    private readonly DbContext _context;

    public UserRepository(DbContext context)
    {
        _context = context;
    }

    public User GetById(int id)
    {
        return _context.Users.Find(id);
    }

    public IEnumerable<User> GetAll()
    {
        return _context.Users.ToList();
    }

    public void Add(User user)
    {
        _context.Users.Add(user);
        _context.SaveChanges();
    }

    public void Update(User user)
    {
        _context.Users.Update(user);
        _context.SaveChanges();
    }

    public void Delete(int id)
    {
        var user = _context.Users.Find(id);
        if (user != null)
        {
            _context.Users.Remove(user);
            _context.SaveChanges();
        }
    }

    public IEnumerable<User> FindByEmail(string email)
    {
        return _context.Users.Where(u => u.Email == email);
    }
}

// Usage in business logic
public class UserService
{
    private readonly IUserRepository _repository;

    public UserService(IUserRepository repository)
    {
        _repository = repository;
    }

    public User GetUser(int id)
    {
        return _repository.GetById(id);
    }
}
```

**When to Use**:

- Separating business logic from data access
- Making code testable (mock repositories)
- Providing consistent data access interface
- When you have complex data access logic

**When NOT to Use**:

- Simple CRUD operations (might be overkill)
- When Entity Framework DbContext is sufficient
- When you don't need to abstract data access

**Common Mistakes**:

- Repository becoming too generic (God object)
- Mixing business logic in repository
- Not using interfaces (hard to test)
- Creating repository for every entity (consider generic repository)

**Best Practices**:

- Use interfaces for repositories
- Keep repositories focused on data access
- Don't put business logic in repositories
- Consider generic repository for simple CRUD
- Use dependency injection

**Interview Tips**:

- Look for scenarios: "abstract data access", "separate business logic"
- Keywords: "data access layer", "testable", "abstraction"
- Repository abstracts data access, Factory creates objects
- May show code asking which pattern separates data access

---

## Behavioral Patterns

### 9. Observer Pattern

**Quick Definition**: Defines one-to-many dependency between objects. When one object changes state, all dependents are notified.

**Problem It Solves**: When you need multiple objects to be notified of state changes in another object, without tight coupling.

**Solution**: Subject maintains list of observers. When state changes, subject notifies all observers. In .NET, implemented with events and delegates.

**C# Implementation**:

```csharp
// Using events (C# way)
public class Stock
{
    private decimal _price;

    public event EventHandler<PriceChangedEventArgs> PriceChanged;

    public decimal Price
    {
        get => _price;
        set
        {
            if (_price != value)
            {
                _price = value;
                OnPriceChanged(new PriceChangedEventArgs(_price));
            }
        }
    }

    protected virtual void OnPriceChanged(PriceChangedEventArgs e)
    {
        PriceChanged?.Invoke(this, e);
    }
}

public class PriceChangedEventArgs : EventArgs
{
    public decimal NewPrice { get; }

    public PriceChangedEventArgs(decimal newPrice)
    {
        NewPrice = newPrice;
    }
}

// Observers
public class StockDisplay
{
    public void OnPriceChanged(object sender, PriceChangedEventArgs e)
    {
        Console.WriteLine($"Stock price changed to: {e.NewPrice}");
    }
}

// Usage
var stock = new Stock();
var display = new StockDisplay();

stock.PriceChanged += display.OnPriceChanged;
stock.Price = 100.50m; // Observer notified
```

**When to Use**:

- Event-driven architectures
- When multiple objects need to react to state changes
- Decoupling publishers from subscribers
- Domain events in DDD

**When NOT to Use**:

- When only one object needs notification (direct call)
- When tight coupling is acceptable
- When performance is critical (events have overhead)

**Common Mistakes**:

- Not unsubscribing from events (memory leaks)
- Tight coupling between subject and observers
- Using Observer when simple callback would work

**Best Practices**:

- Use events and delegates in .NET
- Always unsubscribe to prevent memory leaks
- Consider using `IObservable<T>` and `IObserver<T>` for advanced scenarios
- Use weak events for long-lived subjects

**Interview Tips**:

- Look for scenarios: "notify multiple objects", "state changes"
- Keywords: "event-driven", "publish-subscribe", "notify"
- Observer handles notifications, Command encapsulates requests
- May show code asking which pattern handles domain events

---

### 10. Strategy Pattern

**Quick Definition**: Defines family of algorithms, encapsulates each one, and makes them interchangeable.

**Problem It Solves**: When you have multiple ways to perform the same operation, and you want to select the algorithm at runtime.

**Solution**: Define strategy interface. Implement different strategies. Context class uses strategy interface. Can switch strategies at runtime.

**C# Implementation**:

```csharp
// Strategy interface
public interface IDiscountStrategy
{
    decimal CalculateDiscount(decimal amount);
}

// Concrete strategies
public class RegularCustomerDiscount : IDiscountStrategy
{
    public decimal CalculateDiscount(decimal amount)
    {
        return amount * 0.05m; // 5% discount
    }
}

public class PremiumCustomerDiscount : IDiscountStrategy
{
    public decimal CalculateDiscount(decimal amount)
    {
        return amount * 0.15m; // 15% discount
    }
}

public class VIPCustomerDiscount : IDiscountStrategy
{
    public decimal CalculateDiscount(decimal amount)
    {
        return amount * 0.25m; // 25% discount
    }
}

// Context
public class Order
{
    private IDiscountStrategy _discountStrategy;

    public Order(IDiscountStrategy discountStrategy)
    {
        _discountStrategy = discountStrategy;
    }

    public void SetDiscountStrategy(IDiscountStrategy strategy)
    {
        _discountStrategy = strategy;
    }

    public decimal CalculateTotal(decimal amount)
    {
        var discount = _discountStrategy.CalculateDiscount(amount);
        return amount - discount;
    }
}

// Usage
var order = new Order(new RegularCustomerDiscount());
var total = order.CalculateTotal(100); // 95

order.SetDiscountStrategy(new PremiumCustomerDiscount());
total = order.CalculateTotal(100); // 85
```

**When to Use**:

- Multiple algorithms for same operation
- When you want to switch algorithms at runtime
- When you want to avoid if-else chains for algorithm selection
- Different algorithms based on context

**When NOT to Use**:

- When you have only one algorithm
- When algorithm selection is compile-time (use inheritance)
- When algorithms are too simple (if-else might be fine)

**Common Mistakes**:

- Using if-else chains instead of Strategy
- Creating strategy for simple operations
- Not making strategies interchangeable

**Best Practices**:

- Strategies should be interchangeable
- Keep strategies focused on single algorithm
- Consider using dependency injection
- Use Strategy to eliminate if-else chains

**Interview Tips**:

- Look for scenarios: "different algorithms", "based on context"
- Keywords: "interchangeable", "select algorithm", "different strategies"
- Strategy selects algorithms, Factory creates objects
- May show code with if-else asking for better approach

---

### 11. Command Pattern

**Quick Definition**: Encapsulates a request as an object, allowing parameterization, queuing, and undo operations.

**Problem It Solves**: When you need to parameterize objects with operations, queue operations, or support undo/redo functionality.

**Solution**: Create command interface with `Execute()` method. Concrete commands encapsulate requests. Invoker calls commands. Can store commands for undo/redo.

**C# Implementation**:

```csharp
// Command interface
public interface ICommand
{
    void Execute();
    void Undo();
}

// Concrete command
public class AddTextCommand : ICommand
{
    private readonly TextEditor _editor;
    private readonly string _text;
    private int _position;

    public AddTextCommand(TextEditor editor, string text)
    {
        _editor = editor;
        _text = text;
    }

    public void Execute()
    {
        _position = _editor.CursorPosition;
        _editor.InsertText(_text);
    }

    public void Undo()
    {
        _editor.DeleteText(_position, _text.Length);
    }
}

// Invoker
public class CommandManager
{
    private readonly Stack<ICommand> _history = new();

    public void ExecuteCommand(ICommand command)
    {
        command.Execute();
        _history.Push(command);
    }

    public void Undo()
    {
        if (_history.Count > 0)
        {
            var command = _history.Pop();
            command.Undo();
        }
    }
}

// Usage
var editor = new TextEditor();
var manager = new CommandManager();

var cmd1 = new AddTextCommand(editor, "Hello");
manager.ExecuteCommand(cmd1);

var cmd2 = new AddTextCommand(editor, " World");
manager.ExecuteCommand(cmd2);

manager.Undo(); // Removes " World"
```

**When to Use**:

- Undo/redo functionality
- Queuing operations
- Logging operations
- Macro recording
- Transaction-like behavior

**When NOT to Use**:

- Simple operations that don't need undo
- When performance is critical (command objects have overhead)
- When you don't need queuing or undo

**Common Mistakes**:

- Creating commands for simple operations
- Not implementing undo properly
- Commands becoming too complex

**Best Practices**:

- Keep commands focused on single operation
- Implement undo for all commands
- Consider using command queue for async operations
- Use for operations that need to be logged/queued

**Interview Tips**:

- Look for scenarios: "undo/redo", "queue operations", "macro"
- Keywords: "encapsulate request", "undo", "queue"
- Command encapsulates requests, Observer handles notifications
- Less common but good to know

---

### 12. Template Method Pattern

**Quick Definition**: Defines skeleton of algorithm in base class, letting subclasses override specific steps.

**Problem It Solves**: When you have algorithm with invariant steps and variant steps. Want to avoid code duplication while allowing customization.

**Solution**: Base class defines template method with algorithm steps. Some steps are abstract/virtual for subclasses to override. Template method calls these steps in order.

**C# Implementation**:

```csharp
// Abstract base class
public abstract class DataProcessor
{
    // Template method - defines algorithm skeleton
    public void Process()
    {
        LoadData();
        ValidateData();
        TransformData();
        SaveData();
    }

    protected virtual void LoadData()
    {
        Console.WriteLine("Loading data...");
    }

    protected abstract void ValidateData();
    protected abstract void TransformData();

    protected virtual void SaveData()
    {
        Console.WriteLine("Saving data...");
    }
}

// Concrete implementation
public class CsvDataProcessor : DataProcessor
{
    protected override void ValidateData()
    {
        Console.WriteLine("Validating CSV data...");
    }

    protected override void TransformData()
    {
        Console.WriteLine("Transforming CSV data...");
    }
}

// Another implementation
public class JsonDataProcessor : DataProcessor
{
    protected override void ValidateData()
    {
        Console.WriteLine("Validating JSON data...");
    }

    protected override void TransformData()
    {
        Console.WriteLine("Transforming JSON data...");
    }
}

// Usage
DataProcessor processor = new CsvDataProcessor();
processor.Process(); // Executes template method
```

**When to Use**:

- Algorithm with fixed steps but variable implementations
- Avoiding code duplication in similar algorithms
- When you want to control algorithm structure
- Framework development

**When NOT to Use**:

- When algorithm steps vary significantly
- When you need more flexibility (use Strategy)
- When inheritance is not appropriate

**Common Mistakes**:

- Making too many steps abstract (loses structure)
- Not documenting which methods can be overridden
- Using when Strategy pattern would be better

**Best Practices**:

- Keep template method focused on algorithm structure
- Use `virtual` for optional steps, `abstract` for required
- Document which methods subclasses should override
- Consider using Strategy for more flexibility

**Interview Tips**:

- Look for scenarios: "algorithm skeleton", "subclasses override steps"
- Keywords: "template", "skeleton", "base class defines steps"
- Template Method uses inheritance, Strategy uses composition
- May show code asking which pattern defines algorithm structure

---

### 13. Mediator Pattern

**Quick Definition**: Defines how objects interact without referring to each other directly. Centralizes communication.

**Problem It Solves**: When objects communicate directly with each other, creating tight coupling. Want to reduce dependencies between objects.

**Solution**: Create mediator that handles communication between objects. Objects communicate through mediator, not directly with each other.

**C# Implementation**:

```csharp
// Mediator interface
public interface IChatMediator
{
    void SendMessage(string message, User user);
    void AddUser(User user);
}

// Concrete mediator
public class ChatRoom : IChatMediator
{
    private List<User> _users = new();

    public void AddUser(User user)
    {
        _users.Add(user);
    }

    public void SendMessage(string message, User sender)
    {
        foreach (var user in _users)
        {
            if (user != sender)
                user.Receive(message);
        }
    }
}

// Colleague
public class User
{
    private IChatMediator _mediator;
    public string Name { get; }

    public User(string name, IChatMediator mediator)
    {
        Name = name;
        _mediator = mediator;
    }

    public void Send(string message)
    {
        Console.WriteLine($"{Name} sends: {message}");
        _mediator.SendMessage(message, this);
    }

    public void Receive(string message)
    {
        Console.WriteLine($"{Name} receives: {message}");
    }
}

// Usage
var chatRoom = new ChatRoom();
var alice = new User("Alice", chatRoom);
var bob = new User("Bob", chatRoom);

chatRoom.AddUser(alice);
chatRoom.AddUser(bob);

alice.Send("Hello Bob!"); // Bob receives through mediator
```

**When to Use**:

- Reducing coupling between objects
- When objects communicate in complex ways
- When you want to centralize communication logic
- Chat systems, UI components

**When NOT to Use**:

- When objects communicate simply (direct calls are fine)
- When mediator becomes too complex (God object)
- When you don't need to decouple objects

**Common Mistakes**:

- Mediator becoming too complex (God object)
- Using when simple direct communication would work
- Not properly decoupling objects

**Best Practices**:

- Keep mediator focused on communication
- Don't put business logic in mediator
- Use when communication is complex
- Consider using events for simpler scenarios

**Interview Tips**:

- Look for scenarios: "centralize communication", "reduce coupling"
- Keywords: "mediator", "centralized", "objects don't communicate directly"
- Mediator centralizes communication, Observer handles notifications
- Less common but good to know

---

## Pattern Comparison Table

| Pattern             | Category   | Purpose                    | Key Differentiator                         |
| ------------------- | ---------- | -------------------------- | ------------------------------------------ |
| **Singleton**       | Creational | One instance globally      | Ensures single instance                    |
| **Factory**         | Creational | Create objects             | Creates different types based on condition |
| **Builder**         | Creational | Construct complex objects  | Step-by-step construction                  |
| **Prototype**       | Creational | Clone existing objects     | Copies instead of creating                 |
| **Decorator**       | Structural | Add behavior dynamically   | Wraps and adds functionality               |
| **Adapter**         | Structural | Make interfaces compatible | Changes interface                          |
| **Proxy**           | Structural | Control access to object   | Placeholder, lazy loading                  |
| **Repository**      | Structural | Abstract data access       | Separates data access logic                |
| **Observer**        | Behavioral | Notify of state changes    | One-to-many notifications                  |
| **Strategy**        | Behavioral | Interchangeable algorithms | Selects algorithm at runtime               |
| **Command**         | Behavioral | Encapsulate requests       | Undo/redo, queuing                         |
| **Template Method** | Behavioral | Algorithm skeleton         | Inheritance-based structure                |
| **Mediator**        | Behavioral | Centralize communication   | Objects communicate through mediator       |

---

## Quick Reference: When to Use Which Pattern

### Need to ensure only one instance?

→ **Singleton Pattern**

### Need to create different types based on condition?

→ **Factory Pattern**

### Need to construct complex object step-by-step?

→ **Builder Pattern**

### Need to add behavior without modifying code?

→ **Decorator Pattern**

### Need to make incompatible interfaces work together?

→ **Adapter Pattern**

### Need to control access to object (lazy loading)?

→ **Proxy Pattern**

### Need to abstract data access?

→ **Repository Pattern**

### Need to notify multiple objects of changes?

→ **Observer Pattern**

### Need different algorithms for same operation?

→ **Strategy Pattern**

### Need undo/redo functionality?

→ **Command Pattern**

### Need algorithm skeleton with customizable steps?

→ **Template Method Pattern**

### Need to centralize communication between objects?

→ **Mediator Pattern**

---

## Interview Strategy

### Common Question Types:

1. **"Which pattern is MOST appropriate?"**

   - Read scenario carefully
   - Identify key requirements
   - Match to pattern purpose
   - Eliminate wrong answers

2. **"What pattern does this code demonstrate?"**

   - Look for pattern characteristics
   - Check for key indicators (Singleton: private constructor, Factory: creation method, etc.)
   - Match code structure to pattern

3. **"What's the BEST way to implement...?"**
   - Consider all options
   - Think about maintainability, testability
   - Choose pattern that fits scenario

### Key Differentiators:

- **Singleton vs Factory**: Singleton = one instance, Factory = creates objects
- **Decorator vs Adapter**: Decorator = adds behavior, Adapter = changes interface
- **Proxy vs Decorator**: Proxy = controls access, Decorator = adds behavior
- **Strategy vs Factory**: Strategy = selects algorithm, Factory = creates objects
- **Observer vs Mediator**: Observer = notifications, Mediator = centralized communication

### Memory Aids:

- **Creational**: Create objects (Singleton, Factory, Builder, Prototype)
- **Structural**: Compose objects (Decorator, Adapter, Proxy, Repository)
- **Behavioral**: Communication (Observer, Strategy, Command, Template Method, Mediator)

---

## Common Pattern Combinations

- **Factory + Strategy**: Factory creates strategy objects
- **Repository + Factory**: Factory creates repository instances
- **Decorator + Proxy**: Proxy controls access, Decorator adds behavior
- **Observer + Command**: Commands trigger observers
- **Template Method + Strategy**: Template method uses strategies

---

## .NET-Specific Implementations

### Events and Delegates (Observer Pattern)

```csharp
public event EventHandler<EventArgs> SomethingHappened;
```

### Lazy<T> (Proxy Pattern)

```csharp
private Lazy<ExpensiveObject> _expensive = new Lazy<ExpensiveObject>();
```

### Dependency Injection (Factory Pattern)

```csharp
services.AddScoped<IUserRepository, UserRepository>();
```

### ICloneable (Prototype Pattern)

```csharp
public object Clone() { return MemberwiseClone(); }
```

---

## Final Tips for .NET Interviews

1. **Read questions carefully** - Look for keywords that indicate pattern
2. **Eliminate wrong answers** - Know what each pattern does NOT do
3. **Think about purpose** - What problem is being solved?
4. **Consider .NET context** - Modern .NET prefers DI over Singleton
5. **Trust your knowledge** - You know these patterns from experience

**Remember**: Questions ask for the MOST appropriate pattern, not just a correct one. Consider maintainability, testability, and best practices.

---

**Good luck! You've got this!** 🚀
