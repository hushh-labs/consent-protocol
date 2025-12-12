# React Technical Guide

_Comprehensive deep-dive into React, TypeScript, GraphQL, CSS, and HTML for senior-level interviews_

---

## Table of Contents

1. [React](#react)
2. [TypeScript](#typescript)
3. [GraphQL](#graphql)
4. [CSS](#css)
5. [HTML](#html)

---

## React

### React Fundamentals

#### Component Lifecycle (Class Components)

```javascript
class Component extends React.Component {
  constructor(props) {
    super(props);
    // Initialize state
  }
  
  componentDidMount() {
    // Runs after component mounts to DOM
    // Good for API calls, subscriptions
  }
  
  componentDidUpdate(prevProps, prevState) {
    // Runs after updates
    // Good for reacting to prop/state changes
  }
  
  componentWillUnmount() {
    // Runs before component unmounts
    // Cleanup: remove listeners, cancel requests
  }
  
  render() {
    return <div>Content</div>;
  }
}
```

#### Functional Components & Hooks

**useState**
```javascript
const [state, setState] = useState(initialValue);
const [count, setCount] = useState(0);

// Functional update for complex state
setCount(prevCount => prevCount + 1);
```

**useEffect**
```javascript
// Runs after every render
useEffect(() => {
  // Side effect code
});

// Runs only on mount
useEffect(() => {
  // Side effect code
}, []);

// Runs when dependencies change
useEffect(() => {
  // Side effect code
}, [dependency1, dependency2]);

// Cleanup function
useEffect(() => {
  const subscription = subscribe();
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

**useContext**
```javascript
const ThemeContext = createContext();

// Provider
<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>

// Consumer
const theme = useContext(ThemeContext);
```

**useReducer**
```javascript
const [state, dispatch] = useReducer(reducer, initialState);

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

dispatch({ type: 'increment' });
```

**useMemo**
```javascript
// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
```

**useCallback**
```javascript
// Memoize functions to prevent unnecessary re-renders
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

**Custom Hooks**
```javascript
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);
  
  return { count, increment, decrement, reset };
}
```

### Performance Optimization

#### React.memo
```javascript
// Prevents re-render if props haven't changed
const MemoizedComponent = React.memo(Component, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props are different (re-render)
  return prevProps.name === nextProps.name;
});
```

#### useMemo & useCallback
- Use `useMemo` for expensive calculations
- Use `useCallback` for functions passed as props
- Don't overuse - they have overhead

#### Code Splitting
```javascript
// Lazy loading components
const LazyComponent = React.lazy(() => import('./LazyComponent'));

<Suspense fallback={<div>Loading...</div>}>
  <LazyComponent />
</Suspense>
```

#### Virtual DOM
- React creates a virtual representation of the DOM
- Compares virtual DOM trees (diffing algorithm)
- Only updates actual DOM where changes occurred
- Makes React fast even with frequent updates

### React Patterns

#### Higher-Order Components (HOC)
```javascript
function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const isAuthenticated = useAuth();
    
    if (!isAuthenticated) {
      return <Login />;
    }
    
    return <Component {...props} />;
  };
}
```

#### Render Props
```javascript
<DataProvider render={data => (
  <h1>Hello {data.target}</h1>
)} />

function DataProvider({ render }) {
  const [data, setData] = useState(null);
  // ... fetch data
  return render(data);
}
```

#### Compound Components
```javascript
<Tabs>
  <Tabs.List>
    <Tabs.Tab>Tab 1</Tabs.Tab>
    <Tabs.Tab>Tab 2</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panels>
    <Tabs.Panel>Content 1</Tabs.Panel>
    <Tabs.Panel>Content 2</Tabs.Panel>
  </Tabs.Panels>
</Tabs>
```

### State Management

#### Context API
- Good for: Theme, authentication, global state
- Avoid: Frequently changing state (causes re-renders)

#### Redux
```javascript
// Action
const increment = () => ({ type: 'INCREMENT' });

// Reducer
function counter(state = 0, action) {
  switch (action.type) {
    case 'INCREMENT':
      return state + 1;
    default:
      return state;
  }
}

// Store
const store = createStore(counter);
```

#### Zustand (Lightweight Alternative)
```javascript
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### Testing

#### React Testing Library
```javascript
import { render, screen, fireEvent } from '@testing-library/react';

test('renders button', () => {
  render(<Button>Click me</Button>);
  const button = screen.getByText(/click me/i);
  expect(button).toBeInTheDocument();
});

test('handles click', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click</Button>);
  fireEvent.click(screen.getByText(/click/i));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Common Gotchas

1. **Stale Closures**: Use functional updates with useState
2. **Infinite Loops**: Missing dependencies in useEffect
3. **Unnecessary Re-renders**: Not using memo/useMemo/useCallback
4. **Mutating State**: Always return new objects/arrays
5. **Async in useEffect**: Cleanup functions for subscriptions

---

## TypeScript

### Basic Types

```typescript
let name: string = "John";
let age: number = 30;
let isActive: boolean = true;
let items: string[] = ["a", "b"];
let user: { name: string; age: number } = { name: "John", age: 30 };
```

### Advanced Types

#### Union Types
```typescript
type Status = "loading" | "success" | "error";
let status: Status = "loading";
```

#### Intersection Types
```typescript
type Person = { name: string };
type Employee = { id: number };
type EmployeePerson = Person & Employee;
```

#### Generic Types
```typescript
function identity<T>(arg: T): T {
  return arg;
}

interface Container<T> {
  value: T;
}
```

#### Utility Types

**Partial**
```typescript
type Partial<T> = {
  [P in keyof T]?: T[P];
};

interface User {
  name: string;
  age: number;
}

type PartialUser = Partial<User>; // { name?: string; age?: number; }
```

**Pick**
```typescript
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

type UserName = Pick<User, "name">; // { name: string; }
```

**Omit**
```typescript
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type UserWithoutAge = Omit<User, "age">; // { name: string; }
```

**Record**
```typescript
type Record<K extends keyof any, T> = {
  [P in K]: T;
};

type UserMap = Record<string, User>;
```

### Type Guards

```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function process(value: string | number) {
  if (isString(value)) {
    // TypeScript knows value is string here
    console.log(value.toUpperCase());
  }
}
```

### React with TypeScript

```typescript
interface Props {
  name: string;
  age?: number;
  onClick: (id: number) => void;
}

const Component: React.FC<Props> = ({ name, age = 0, onClick }) => {
  const [count, setCount] = useState<number>(0);
  
  return <div onClick={() => onClick(count)}>{name}</div>;
};
```

### Common Patterns

```typescript
// Event handlers
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value);
};

// Ref types
const inputRef = useRef<HTMLInputElement>(null);

// Generic components
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <div>{items.map(renderItem)}</div>;
}
```

---

## GraphQL

### Queries

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    posts {
      title
      content
    }
  }
}
```

### Mutations

```graphql
mutation CreateUser($input: UserInput!) {
  createUser(input: $input) {
    id
    name
    email
  }
}
```

### Subscriptions

```graphql
subscription OnUserUpdate($userId: ID!) {
  userUpdated(userId: $userId) {
    id
    name
    status
  }
}
```

### Apollo Client

#### Setup
```javascript
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.example.com/graphql',
  cache: new InMemoryCache()
});

<ApolloProvider client={client}>
  <App />
</ApolloProvider>
```

#### useQuery Hook
```javascript
import { useQuery, gql } from '@apollo/client';

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;

function User({ userId }) {
  const { loading, error, data } = useQuery(GET_USER, {
    variables: { id: userId }
  });
  
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  
  return <div>{data.user.name}</div>;
}
```

#### useMutation Hook
```javascript
import { useMutation, gql } from '@apollo/client';

const CREATE_USER = gql`
  mutation CreateUser($input: UserInput!) {
    createUser(input: $input) {
      id
      name
    }
  }
`;

function CreateUserForm() {
  const [createUser, { loading, error }] = useMutation(CREATE_USER);
  
  const handleSubmit = async (formData) => {
    try {
      const { data } = await createUser({
        variables: { input: formData }
      });
      console.log('User created:', data.createUser);
    } catch (err) {
      console.error(err);
    }
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Caching Strategies

#### Cache Policies
```javascript
const { data } = useQuery(GET_USER, {
  fetchPolicy: 'cache-first', // Default
  // Options: cache-first, cache-and-network, network-only, cache-only, no-cache
});
```

#### Updating Cache
```javascript
const [createUser] = useMutation(CREATE_USER, {
  update(cache, { data: { createUser } }) {
    cache.modify({
      fields: {
        users(existingUsers = []) {
          const newUserRef = cache.writeFragment({
            data: createUser,
            fragment: gql`
              fragment NewUser on User {
                id
                name
              }
            `
          });
          return [...existingUsers, newUserRef];
        }
      }
    });
  }
});
```

### Error Handling

```javascript
const { data, error, loading } = useQuery(GET_USER);

if (error) {
  if (error.networkError) {
    // Handle network error
  }
  if (error.graphQLErrors) {
    // Handle GraphQL errors
    error.graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`GraphQL error: ${message}`);
    });
  }
}
```

---

## CSS

### Flexbox

```css
.container {
  display: flex;
  flex-direction: row; /* row | column | row-reverse | column-reverse */
  justify-content: center; /* flex-start | flex-end | center | space-between | space-around | space-evenly */
  align-items: center; /* flex-start | flex-end | center | baseline | stretch */
  flex-wrap: wrap; /* nowrap | wrap | wrap-reverse */
  gap: 1rem;
}

.item {
  flex: 1; /* flex-grow flex-shrink flex-basis */
  align-self: flex-start;
}
```

### Grid

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 1rem;
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

### Responsive Design

```css
/* Mobile First */
.container {
  width: 100%;
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    max-width: 750px;
    margin: 0 auto;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
  }
}
```

### Modern CSS Features

#### CSS Variables
```css
:root {
  --primary-color: #007bff;
  --spacing: 1rem;
}

.button {
  background-color: var(--primary-color);
  padding: var(--spacing);
}
```

#### Container Queries
```css
.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card-content {
    display: flex;
  }
}
```

#### Animations
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.element {
  animation: fadeIn 0.3s ease-in-out;
}
```

### CSS Preprocessors (SASS)

```scss
// Variables
$primary-color: #007bff;
$spacing: 1rem;

// Nesting
.button {
  background-color: $primary-color;
  padding: $spacing;
  
  &:hover {
    background-color: darken($primary-color, 10%);
  }
  
  &--large {
    padding: $spacing * 2;
  }
}

// Mixins
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  @include flex-center;
}
```

---

## HTML

### Semantic HTML5

```html
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Article Title</h1>
    <section>
      <h2>Section Title</h2>
      <p>Content</p>
    </section>
  </article>
  
  <aside>
    <h2>Related Content</h2>
  </aside>
</main>

<footer>
  <p>Copyright 2025</p>
</footer>
```

### Accessibility (ARIA)

```html
<!-- Labels -->
<label for="email">Email</label>
<input type="email" id="email" aria-required="true" />

<!-- Roles -->
<div role="button" tabindex="0" aria-label="Close dialog">
  ×
</div>

<!-- Live regions -->
<div aria-live="polite" aria-atomic="true">
  Status updates appear here
</div>

<!-- Descriptions -->
<input type="text" aria-describedby="email-help" />
<span id="email-help">Enter your email address</span>
```

### Forms

```html
<form>
  <fieldset>
    <legend>Personal Information</legend>
    
    <label for="name">Name *</label>
    <input 
      type="text" 
      id="name" 
      name="name" 
      required 
      aria-required="true"
      minlength="2"
      maxlength="50"
    />
    
    <label for="email">Email *</label>
    <input 
      type="email" 
      id="email" 
      name="email" 
      required
      pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
    />
    
    <button type="submit">Submit</button>
  </fieldset>
</form>
```

### SEO Best Practices

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Page description for SEO">
  <meta name="keywords" content="keyword1, keyword2">
  <title>Page Title</title>
  
  <!-- Open Graph -->
  <meta property="og:title" content="Page Title">
  <meta property="og:description" content="Page description">
  <meta property="og:image" content="image.jpg">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="https://example.com/page">
</head>
```

### Performance

```html
<!-- Lazy loading images -->
<img src="image.jpg" loading="lazy" alt="Description" />

<!-- Preconnect to external domains -->
<link rel="preconnect" href="https://api.example.com" />

<!-- Preload critical resources -->
<link rel="preload" href="font.woff2" as="font" type="font/woff2" crossorigin />

<!-- Defer non-critical scripts -->
<script src="analytics.js" defer></script>
```

---

## Best Practices Summary

### React
- Use functional components and hooks
- Optimize with memo, useMemo, useCallback when needed
- Keep components small and focused
- Extract custom hooks for reusable logic
- Test components with React Testing Library

### TypeScript
- Use strict mode
- Prefer interfaces for object shapes
- Use type guards for runtime checks
- Leverage utility types
- Avoid `any` - use `unknown` when type is truly unknown

### GraphQL
- Use fragments for reusable fields
- Implement proper error handling
- Optimize queries (only request needed fields)
- Use cache policies appropriately
- Handle loading and error states

### CSS
- Use semantic class names (BEM, CSS Modules)
- Mobile-first responsive design
- Use CSS variables for theming
- Leverage Flexbox and Grid appropriately
- Keep specificity low

### HTML
- Use semantic HTML5 elements
- Ensure accessibility (ARIA when needed)
- Optimize for SEO
- Validate HTML
- Consider performance (lazy loading, preconnect)

---

_This guide covers the essential technical knowledge for senior React/UI Engineer interviews. Practice implementing these concepts in real projects!_


