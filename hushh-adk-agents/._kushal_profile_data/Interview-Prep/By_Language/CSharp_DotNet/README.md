# .NET Interview Preparation Guide

_Technology-based preparation materials for .NET, C#, and ASP.NET interviews - reusable across any company_

---

## Quick Start

### If you have 2-3 hours:

1. Review `quick_reference.md` - Last-minute cheat sheet
2. Practice 5-10 scenarios from `practice_scenarios.md`
3. Review design patterns from `architecture_design_patterns.md`

### If you have 1 day:

1. Follow `study_schedule.md` - Hour-by-hour breakdown
2. Read `architecture_design_patterns.md` - Comprehensive design patterns guide
3. Complete practice scenarios
4. Review modern C# features in `platform_tips.md`

### If you have multiple days:

1. Deep dive into `architecture_design_patterns.md`
2. Complete all practice scenarios and concept drills
3. Build sample projects using concepts
4. Review and refine understanding

---

## File Descriptions

### Core Study Materials

**study_schedule.md**

- Flexible time plans (2-3 hours, 1 day, multi-day)
- Hour-by-hour breakdown for comprehensive prep
- Focus areas and time allocation

**architecture_design_patterns.md**

- Comprehensive guide covering all design patterns
- Creational patterns (Singleton, Factory, Builder, Prototype)
- Structural patterns (Decorator, Adapter, Proxy, Repository)
- Behavioral patterns (Observer, Strategy, Command, Template Method, Mediator)
- C# implementation examples for each pattern
- When to use / when NOT to use each pattern
- Common mistakes and best practices
- Interview-specific tips and question patterns

**quick_reference.md**

- Collections: When to use what (List, Dictionary, HashSet, Queue, Stack)
- LINQ comprehensive guide
- Async/Await deep dive
- Modern C# features (Records, Pattern Matching)
- Common gotchas and mistakes
- Performance comparison table
- Last-minute memory dump

**practice_scenarios.md**

- Scenario-based practice questions
- Performance and efficiency scenarios
- Code analysis and debugging
- Architecture and design patterns
- Modern C# and best practices
- Detailed explanations with time/space complexity
- Common mistakes and best practices

**concept_drills.md**

- High-impact exercises
- Reinforces key concepts through practice
- Code tracing exercises
- Focused drills for rapid improvement

**platform_tips.md**

- Online assessment platform tips
- Browser compatibility tips
- Question patterns (BEST vs CORRECT)
- Modern C# features (C# 10, 11, 12)
- Assessment strategies

**assessment_notes.md**

- Template for tracking company-specific interview experiences
- Record questions asked, learnings, and improvements
- Fill out after each interview

---

## Study Strategy

### Technical Focus Areas

**Design Patterns**

- Creational: Singleton, Factory, Builder, Prototype
- Structural: Decorator, Adapter, Proxy, Repository
- Behavioral: Observer, Strategy, Command, Template Method, Mediator
- Know when to use each pattern
- Understand trade-offs

**Collections**

- List, Dictionary, HashSet, Queue, Stack
- Time complexity for each operation
- When to use which collection
- Common mistakes and best practices

**LINQ**

- Deferred execution
- Materialization (ToList, ToArray)
- Method syntax vs query syntax
- Performance considerations
- Common pitfalls

**Async/Await**

- Task-based asynchronous programming
- Task.WhenAll for parallel operations
- Never use .Result or .Wait()
- Exception handling in async code
- Best practices

**Modern C#**

- Records (C# 9+)
- Pattern matching
- Nullable reference types
- Init-only properties
- Top-level statements
- Global using directives

**Common Gotchas**

- String immutability
- Value vs reference types
- Collection modification during iteration
- Multiple LINQ enumeration
- Integer division
- Null reference exceptions

### Interview Types

**Technical Interviews**

- Code analysis questions
- Design pattern identification
- Performance optimization
- Debugging scenarios
- Architecture discussions

**Online Assessments**

- Timed coding questions
- Multiple choice questions
- Code output prediction
- Best practice selection

---

## How to Use This Prep for Any Company

1. **Review Technical Guide**: Core concepts apply to all .NET roles
2. **Practice Scenarios**: Use coding challenges for any technical interview
3. **Research Company**: Add company-specific context to `assessment_notes.md`
4. **Quick Reference**: Use as last-minute review before any interview
5. **Adapt to Role**: Focus on relevant patterns and concepts for the specific role

---

## Common Interview Patterns

### Design Pattern Questions

- "Which pattern is MOST appropriate for this scenario?"
- "What pattern does this code demonstrate?"
- "How would you implement [pattern] in C#?"

### Collections Questions

- "Which collection should you use for [scenario]?"
- "What's the time complexity of [operation]?"
- "What's the difference between List and HashSet?"

### LINQ Questions

- "What will this LINQ query output?"
- "How do you optimize this LINQ query?"
- "Explain deferred execution"

### Async/Await Questions

- "How do you run multiple async operations in parallel?"
- "What's wrong with this async code?"
- "How do you handle exceptions in async methods?"

### Modern C# Questions

- "What are records and when do you use them?"
- "Explain pattern matching in C#"
- "What are nullable reference types?"

---

## Last-Minute Checklist

Before any interview, quickly review:

- [ ] Design Patterns - Quick reference (Singleton, Factory, Repository, Decorator, Observer, Strategy)
- [ ] Collections time complexity (List vs Dictionary vs HashSet)
- [ ] LINQ deferred execution - materialize with ToList() if needed multiple times
- [ ] Async best practices - use await, never .Result or .Wait()
- [ ] Common gotchas - string immutability, integer division, null references
- [ ] Modern C# features - records, pattern matching, init-only properties
- [ ] Value vs reference types
- [ ] Exception handling patterns

---

## Post-Interview

After each interview:

1. Fill out `assessment_notes.md` immediately
2. Record questions asked
3. Note areas that need improvement
4. Update prep materials based on learnings
5. Refine understanding of challenging concepts

---

## Good Luck!

Focus on understanding concepts deeply, not just memorizing. Be ready to explain your thought process and trade-offs.

Remember: These materials are designed to be reusable across any company. Adapt the examples to match the company you're interviewing with!

---

_Last Updated: November 2025_

