# Architecture Basics - Round 1

**Quick reference for architecture questions**

---

## 4+1 View Model

### 1. Logical View (What the system does)

- **Business logic** and functionality
- Classes, objects, packages
- **Example**: User management module, payment processing

### 2. Process View (How it behaves)

- **Runtime behavior**, concurrency
- Processes, threads, interactions
- **Example**: Request handling flow, async processing

### 3. Development View (How it's organized)

- **Code organization**, layers
- Modules, packages, dependencies
- **Example**: Presentation → Business → Data layers

### 4. Physical View (Where it runs)

- **Deployment**, hardware
- Servers, containers, network topology
- **Example**: Azure App Service, SQL Database, CDN

### +1. Scenarios (Use Cases)

- **User journeys** that tie views together
- **Example**: "User logs in → Authenticates → Sees dashboard"

---

## Non-Functional Requirements (NFRs)

### Scalability

- System can handle increased load
- **Example**: Horizontal scaling with Azure App Service

### Performance

- Response time, throughput
- **Example**: API response < 200ms, 1000 req/sec

### Availability

- Uptime, fault tolerance
- **Example**: 99.9% uptime, multi-region deployment

### Security

- Authentication, authorization, data protection
- **Example**: Azure AD, HTTPS, encryption at rest

### Maintainability

- Code quality, testability
- **Example**: SOLID principles, unit tests, CI/CD

---

## Integration Patterns

### API Gateway

- Single entry point for all clients
- Handles routing, auth, rate limiting
- **Example**: Azure API Management

### Microservices

- Small, independent services
- Each owns its data
- **Example**: User service, Payment service, Notification service

### Event-Driven

- Services communicate via events
- Loose coupling
- **Example**: Azure Service Bus, Event Grid

### RESTful APIs

- HTTP-based, stateless
- Standard verbs (GET, POST, PUT, DELETE)
- **Example**: `/api/users/{id}`

---

## Quick Examples for Interview

**If asked about 4+1**:
"The 4+1 model helps visualize architecture from multiple perspectives. For example, in a recent project, we used the Logical View to define business modules, the Process View to handle async operations, and the Physical View to map deployment to Azure."

**If asked about NFRs**:
"For scalability, we used Azure App Service with auto-scaling. For performance, we implemented caching with Redis. For availability, we deployed across multiple regions with Traffic Manager."

**If asked about integration**:
"We used microservices architecture with each service exposing RESTful APIs. An API Gateway handled routing and auth. Services communicated asynchronously via Azure Service Bus for event-driven workflows."

---

**Keep it simple. Don't overthink.** 🎯
