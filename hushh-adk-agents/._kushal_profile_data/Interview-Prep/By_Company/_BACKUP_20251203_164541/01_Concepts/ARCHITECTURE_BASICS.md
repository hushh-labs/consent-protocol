# Architecture Basics for Deloitte Interview

**Target Audience**: Full Stack Engineer | Product Engineering
**Focus**: Round 1 (Basics) & Round 2 (Deep Dive)

---

## 1. The "4+1" View Model of Architecture

Deloitte specifically asks for this. It is a standard way to describe software architecture using 5 concurrent views.

### Why "4+1"?

It uses **4 logical views** to describe the system, plus **1 scenario view** (Use Cases) that ties them all together.

### The 5 Views:

#### 1. Logical View (End User Functionality)

- **What it shows**: The functional requirements. What does the system _do_?
- **Diagrams**: Class Diagrams, State Diagrams.
- **Audience**: End Users, Analysts.
- **Example**: "The `User` class relates to the `Order` class."

#### 2. Process View (Runtime Behavior)

- **What it shows**: Concurrency, threads, processes, and how they communicate.
- **Diagrams**: Sequence Diagrams, Activity Diagrams.
- **Audience**: Integrators, Developers.
- **Example**: "When the user clicks 'Buy', the frontend calls the API, which puts a message on the queue."

#### 3. Development View (Implementation)

- **What it shows**: Code structure, packages, libraries, folder hierarchy.
- **Diagrams**: Package Diagrams, Component Diagrams.
- **Audience**: Programmers, Software Managers.
- **Example**: "The `Core.dll` library is used by the `Web.UI` project."

#### 4. Physical View (Deployment)

- **What it shows**: Hardware mapping. Where does the code actually run?
- **Diagrams**: Deployment Diagrams.
- **Audience**: System Engineers, DevOps.
- **Example**: "The Web App runs on Azure App Service, the DB runs on Azure SQL."

#### +1. Scenarios (Use Cases)

- **What it shows**: Small set of use cases that validate the architecture.
- **Diagrams**: Use Case Diagrams.
- **Audience**: All Stakeholders.
- **Example**: "A user logs in and purchases an item." (This scenario touches all 4 other views).

---

## 2. Non-Functional Requirements (NFRs)

These are the "Quality Attributes" of the system. In an interview, **always** mention these when designing a system.

### The "ilities":

1.  **Scalability**: Can the system handle 10x more users?

    - _Vertical Scaling_: Bigger server (more RAM/CPU).
    - _Horizontal Scaling_: More servers (Load Balancer).
    - _Deloitte Context_: Azure App Service Plan auto-scaling.

2.  **Availability**: Is the system up 99.9% of the time?

    - _Redundancy_: Multiple instances.
    - _Failover_: If Region A goes down, Region B takes over.

3.  **Reliability**: Does it produce correct results consistently?

    - _Data Integrity_: Transactions (ACID).
    - _Error Handling_: Retries, Circuit Breakers.

4.  **Maintainability**: Is the code easy to fix and update?

    - _Clean Code_: SOLID principles.
    - _Documentation_: 4+1 diagrams.
    - _CI/CD_: Automated testing and deployment.

5.  **Security**: Is data protected?
    - _Authentication_: Who are you? (OAuth, SSO).
    - _Authorization_: What can you do? (RBAC).
    - _Encryption_: At rest (DB) and in transit (HTTPS).

---

## 3. Integration Patterns

How do different parts of the system talk to each other?

### 1. API Gateway (The "Front Door")

- **Concept**: A single entry point for all client requests.
- **Why**: Handles routing, authentication, rate limiting, and caching.
- **Azure Tool**: Azure API Management (APIM).

### 2. Microservices (The "Decoupled" Approach)

- **Concept**: Breaking a monolith into small, independent services (e.g., "User Service", "Order Service").
- **Pros**: Independent scaling, technology agnostic.
- **Cons**: Complexity in debugging and deployment.

### 3. Event-Driven Architecture (The "Async" Approach)

- **Concept**: Services communicate by emitting events, not by calling each other directly.
- **Why**: Decoupling. If "Order Service" is down, "User Service" can still emit a "UserCreated" event.
- **Azure Tool**: Azure Service Bus, Event Grid.

---

## 4. Interview Cheat Sheet

| Concept           | Key Phrase to Use                                                                          |
| :---------------- | :----------------------------------------------------------------------------------------- |
| **4+1**           | "I use the 4+1 model to ensure I'm communicating the right view to the right stakeholder." |
| **Scalability**   | "I'd design this to scale horizontally using Azure App Service."                           |
| **Reliability**   | "We should implement a Circuit Breaker pattern to prevent cascading failures."             |
| **Security**      | "We need to ensure encryption in transit (TLS) and at rest."                               |
| **Microservices** | "We should only split into microservices if the domain complexity warrants it."            |
