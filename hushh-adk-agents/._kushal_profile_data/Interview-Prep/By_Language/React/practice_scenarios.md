# Practice Scenarios & Coding Challenges

_Real-world coding challenges and scenarios for React, TypeScript, GraphQL, CSS interviews_

---

## React Component Challenges

### Challenge 1: Todo List Component

**Requirements:**
- Create a TodoList component with add, complete, and delete functionality
- Use TypeScript
- Implement proper state management
- Add input validation
- Make it accessible

**Expected Solution:**
```typescript
interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  
  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, {
        id: Date.now().toString(),
        text: input,
        completed: false
      }]);
      setInput('');
    }
  };
  
  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };
  
  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };
  
  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        aria-label="Todo input"
      />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

**Follow-up Questions:**
- How would you optimize this for performance?
- How would you persist todos?
- How would you add filtering (all/active/completed)?

---

### Challenge 2: Search with Debouncing

**Requirements:**
- Create a search input that debounces API calls
- Show loading state
- Handle errors
- Display results

**Expected Solution:**
```typescript
const SearchComponent: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${query}`);
        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError('Failed to search');
      } finally {
        setLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [query]);
  
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {loading && <div>Loading...</div>}
      {error && <div>{error}</div>}
      <ul>
        {results.map((result: any) => (
          <li key={result.id}>{result.name}</li>
        ))}
      </ul>
    </div>
  );
};
```

**Follow-up Questions:**
- How would you cancel in-flight requests?
- How would you implement caching?
- How would you handle pagination?

---

### Challenge 3: Custom Hook - useFetch

**Requirements:**
- Create a reusable `useFetch` hook
- Handle loading, error, and data states
- Support different HTTP methods
- Type-safe with TypeScript

**Expected Solution:**
```typescript
interface UseFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

function useFetch<T>(url: string, options?: UseFetchOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url, {
          method: options?.method || 'GET',
          body: options?.body ? JSON.stringify(options.body) : undefined,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [url, options?.method]);
  
  return { data, loading, error };
}
```

---

## TypeScript Challenges

### Challenge 4: Type-Safe API Client

**Requirements:**
- Create a type-safe API client
- Support different endpoints with different return types
- Handle errors properly

**Expected Solution:**
```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    const data = await response.json();
    return {
      data: data as T,
      status: response.status,
    };
  }
  
  async post<T, U>(endpoint: string, body: U): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return {
      data: data as T,
      status: response.status,
    };
  }
}

// Usage
interface User {
  id: number;
  name: string;
}

const client = new ApiClient('https://api.example.com');
const { data } = await client.get<User[]>('/users');
```

---

### Challenge 5: Generic Form Component

**Requirements:**
- Create a reusable form component with TypeScript
- Support different field types
- Type-safe validation

**Expected Solution:**
```typescript
interface FormField<T> {
  name: keyof T;
  label: string;
  type: 'text' | 'email' | 'number';
  required?: boolean;
  validate?: (value: any) => string | null;
}

interface FormProps<T> {
  fields: FormField<T>[];
  onSubmit: (data: T) => void;
  initialValues?: Partial<T>;
}

function Form<T extends Record<string, any>>({
  fields,
  onSubmit,
  initialValues = {},
}: FormProps<T>) {
  const [values, setValues] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleChange = (name: keyof T, value: any) => {
    setValues({ ...values, [name]: value });
    // Clear error when user types
    if (errors[name as string]) {
      setErrors({ ...errors, [name]: '' });
    }
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      const value = values[field.name];
      
      if (field.required && !value) {
        newErrors[field.name as string] = `${field.label} is required`;
      } else if (field.validate) {
        const error = field.validate(value);
        if (error) {
          newErrors[field.name as string] = error;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(values as T);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {fields.map(field => (
        <div key={field.name as string}>
          <label>{field.label}</label>
          <input
            type={field.type}
            value={values[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
          {errors[field.name as string] && (
            <span>{errors[field.name as string]}</span>
          )}
        </div>
      ))}
      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## GraphQL Challenges

### Challenge 6: GraphQL Query Optimization

**Scenario:** You have a query that fetches user data with nested posts and comments. The query is slow.

**Initial Query:**
```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    posts {
      id
      title
      content
      comments {
        id
        text
        author {
          id
          name
        }
      }
    }
  }
}
```

**Optimization Strategies:**
1. Only request needed fields
2. Use pagination for lists
3. Implement field-level resolvers with DataLoader (backend)
4. Use fragments for reusable fields
5. Implement caching

**Optimized Query:**
```graphql
fragment UserBasic on User {
  id
  name
  email
}

fragment PostBasic on Post {
  id
  title
}

query GetUser($id: ID!, $first: Int, $after: String) {
  user(id: $id) {
    ...UserBasic
    posts(first: $first, after: $after) {
      edges {
        node {
          ...PostBasic
          comments(first: 5) {
            text
            author {
              name
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

---

## CSS Challenges

### Challenge 7: Responsive Card Layout

**Requirements:**
- Create a responsive card grid
- 1 column on mobile, 2 on tablet, 3 on desktop
- Cards should have equal height
- Use CSS Grid

**Solution:**
```css
.card-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.card {
  display: flex;
  flex-direction: column;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1rem;
}

.card-content {
  flex: 1;
}
```

---

### Challenge 8: Centering Content

**Requirements:**
- Center content both horizontally and vertically
- Multiple solutions (Flexbox, Grid, absolute positioning)

**Solutions:**
```css
/* Flexbox */
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

/* Grid */
.container {
  display: grid;
  place-items: center;
  height: 100vh;
}

/* Absolute positioning */
.container {
  position: relative;
  height: 100vh;
}

.content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

---

## System Design Scenarios

### Challenge 9: Design a Component Library

**Requirements:**
- Design a reusable component library
- Consider: theming, accessibility, documentation, versioning

**Key Considerations:**
- Component architecture (atomic design)
- Theming system (CSS variables, theme provider)
- TypeScript for type safety
- Storybook for documentation
- Testing strategy
- Versioning and distribution
- Accessibility standards (WCAG)

---

### Challenge 10: Optimize Large React Application

**Scenario:** Application with 100+ components, slow initial load, poor performance.

**Optimization Strategies:**
1. Code splitting (route-based, component-based)
2. Lazy loading
3. Bundle analysis and optimization
4. Tree shaking
5. Image optimization
6. Caching strategies
7. Virtual scrolling for large lists
8. Memoization (React.memo, useMemo, useCallback)
9. Service workers for offline support
10. CDN for static assets

---

## Practice Tips

1. **Code on whiteboard/paper** - Simulates interview conditions
2. **Time yourself** - Practice under pressure
3. **Explain your thinking** - Practice verbalizing your approach
4. **Handle edge cases** - Think about error handling, empty states
5. **Optimize after** - First make it work, then optimize
6. **Ask clarifying questions** - Shows communication skills

---

## Common Follow-Up Questions

After solving a challenge, be ready for:

- "How would you test this?"
- "How would you optimize this?"
- "What edge cases should we consider?"
- "How would you handle errors?"
- "How would you make this accessible?"
- "How would you scale this?"

---

_Practice these scenarios regularly. Focus on understanding the concepts, not just memorizing solutions!_


