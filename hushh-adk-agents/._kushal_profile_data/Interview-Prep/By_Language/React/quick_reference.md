# Quick Reference - Last Minute Cheat Sheet

_Quick reference for React, TypeScript, GraphQL, CSS, and HTML - review before interview_

---

## React Hooks Quick Reference

### useState
```javascript
const [state, setState] = useState(initialValue);
setState(newValue);
setState(prev => prev + 1); // Functional update
```

### useEffect
```javascript
useEffect(() => {
  // Runs after every render
});

useEffect(() => {
  // Runs once on mount
}, []);

useEffect(() => {
  // Runs when deps change
  return () => {
    // Cleanup
  };
}, [dep1, dep2]);
```

### useContext
```javascript
const value = useContext(MyContext);
```

### useReducer
```javascript
const [state, dispatch] = useReducer(reducer, initialState);
dispatch({ type: 'ACTION', payload: data });
```

### useMemo
```javascript
const memoized = useMemo(() => compute(a, b), [a, b]);
```

### useCallback
```javascript
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

### useRef
```javascript
const ref = useRef(initialValue);
ref.current = newValue;
```

---

## React Performance

- **React.memo**: Prevents re-render if props unchanged
- **useMemo**: Memoize expensive calculations
- **useCallback**: Memoize functions passed as props
- **Code splitting**: `React.lazy()` + `Suspense`
- **Virtual DOM**: React's diffing algorithm

---

## TypeScript Quick Patterns

### Common Types
```typescript
type Status = "loading" | "success" | "error";
type User = { id: number; name: string };
type Optional<T> = T | null;
```

### Utility Types
```typescript
Partial<T>      // All properties optional
Pick<T, K>      // Select properties
Omit<T, K>      // Exclude properties
Record<K, T>    // Map type
```

### Type Guards
```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

### React with TypeScript
```typescript
interface Props {
  name: string;
  onClick: (id: number) => void;
}

const Component: React.FC<Props> = ({ name, onClick }) => {
  const [count, setCount] = useState<number>(0);
  return <div onClick={() => onClick(count)}>{name}</div>;
};
```

---

## GraphQL Quick Reference

### Query
```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}
```

### Mutation
```graphql
mutation CreateUser($input: UserInput!) {
  createUser(input: $input) {
    id
    name
  }
}
```

### Apollo Client
```javascript
const { data, loading, error } = useQuery(GET_USER, {
  variables: { id: userId }
});

const [createUser, { loading }] = useMutation(CREATE_USER);
```

---

## CSS Layout Quick Reference

### Flexbox
```css
.container {
  display: flex;
  flex-direction: row | column;
  justify-content: center | space-between;
  align-items: center | flex-start;
  gap: 1rem;
}
```

### Grid
```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
```

### Responsive
```css
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## HTML Semantic Elements

```html
<header>, <nav>, <main>, <article>, <section>
<aside>, <footer>, <figure>, <figcaption>
```

---

## Common Interview Questions

### React
- **Virtual DOM**: React's in-memory representation, diffing algorithm
- **Hooks vs Classes**: Hooks allow state in functional components
- **useState vs useReducer**: useState for simple state, useReducer for complex
- **useEffect cleanup**: Prevents memory leaks, cancels subscriptions
- **Performance**: memo, useMemo, useCallback, code splitting

### TypeScript
- **Generics**: Reusable code that works with multiple types
- **Type vs Interface**: Interfaces for object shapes, types for unions/intersections
- **Type narrowing**: Type guards to narrow types
- **Utility types**: Partial, Pick, Omit, Record

### GraphQL
- **vs REST**: Single endpoint, client specifies data needed
- **Queries**: Read data
- **Mutations**: Modify data
- **Subscriptions**: Real-time updates
- **Caching**: Apollo Client cache policies

### CSS
- **Flexbox vs Grid**: Flexbox for 1D, Grid for 2D layouts
- **BEM**: Block__Element--Modifier naming convention
- **CSS Variables**: `--variable-name: value; var(--variable-name)`
- **Responsive**: Mobile-first, media queries

### HTML
- **Semantic HTML**: Meaningful elements (header, nav, main)
- **Accessibility**: ARIA attributes, alt text, keyboard navigation
- **SEO**: Meta tags, semantic HTML, proper heading hierarchy

---

## Common Gotchas

### React
- Stale closures in useEffect (use functional updates)
- Missing dependencies in useEffect (causes bugs)
- Mutating state directly (always return new objects/arrays)
- Infinite loops (missing cleanup or dependencies)

### TypeScript
- Using `any` (use `unknown` instead)
- Not using strict mode
- Forgetting to handle null/undefined

### GraphQL
- Over-fetching (request only needed fields)
- N+1 queries (use data loaders)
- Not handling errors properly

### CSS
- Specificity wars (keep it low)
- Not mobile-first
- Forgetting vendor prefixes (use autoprefixer)

---

## Performance Tips

### React
- Use React.memo for expensive components
- useMemo for expensive calculations
- useCallback for functions in props
- Code split large bundles
- Lazy load routes/components

### CSS
- Use transform/opacity for animations (GPU accelerated)
- Avoid layout thrashing
- Minimize repaints/reflows
- Use will-change sparingly

### HTML
- Lazy load images
- Preconnect to external domains
- Defer non-critical scripts
- Minimize DOM manipulation

---

## Last-Minute Checklist

Before interview, review:

- [ ] React hooks (useState, useEffect, useContext, useMemo, useCallback)
- [ ] TypeScript utility types (Partial, Pick, Omit, Record)
- [ ] GraphQL query structure
- [ ] CSS Flexbox and Grid basics
- [ ] HTML semantic elements
- [ ] 3-5 STAR format stories ready
- [ ] Common gotchas and best practices
- [ ] Performance optimization techniques

---

## Quick Mental Models

### React
- Components are functions that return UI
- State changes trigger re-renders
- Props flow down, events flow up
- Hooks let you "hook into" React features

### TypeScript
- Types describe the shape of data
- Generics make code reusable
- Type guards narrow types at runtime
- Utility types transform existing types

### GraphQL
- Client requests exactly what it needs
- Single endpoint for all operations
- Strongly typed schema
- Powerful developer tools

### CSS
- Flexbox: One-dimensional layouts
- Grid: Two-dimensional layouts
- Mobile-first: Start small, scale up
- BEM: Block__Element--Modifier

---

_Keep this handy for last-minute review! Good luck!_


