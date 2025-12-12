# JavaScript/TypeScript Quick Reference

**Essential methods for LeetCode problems**

---

## Array Methods

### Essential Array Operations

```javascript
// Create
const arr = [1, 2, 3];
const arr2 = new Array(5).fill(0);

// Access
arr[0];                    // O(1)
arr.length;                // O(1)

// Modify
arr.push(4);               // O(1) - add to end
arr.pop();                 // O(1) - remove from end
arr.unshift(0);            // O(n) - add to start
arr.shift();               // O(n) - remove from start
arr[0] = 10;               // O(1) - update
```

**Time Complexity**: O(1) for push/pop/indexing, O(n) for shift/unshift  
**Space Complexity**: O(n) for array storage

---

### Array Iteration

```javascript
// for...of (most common)
for (const num of nums) {
    // Process num
}

// forEach
nums.forEach((num, index) => {
    // Process num and index
});

// Traditional for loop
for (let i = 0; i < nums.length; i++) {
    // Process nums[i]
}
```

**Time Complexity**: O(n)  
**Space Complexity**: O(1)

---

### Array Transformation

```javascript
// map - transform each element
const doubled = nums.map(x => x * 2);        // O(n)

// filter - keep elements matching condition
const evens = nums.filter(x => x % 2 === 0); // O(n)

// reduce - aggregate to single value
const sum = nums.reduce((acc, x) => acc + x, 0); // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n) for result

---

### Array Search

```javascript
// find - first element matching condition
const found = nums.find(x => x > 5);         // O(n)

// includes - check if element exists
const has = nums.includes(5);                // O(n)

// indexOf - find index of element
const index = nums.indexOf(5);               // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(1)

---

### Array Manipulation

```javascript
// slice - extract portion (doesn't modify original)
const sub = nums.slice(0, 3);               // O(k) where k is length

// splice - remove/insert elements (modifies original)
nums.splice(1, 2);                          // O(n)
nums.splice(1, 0, 10, 20);                  // O(n) - insert

// concat - combine arrays
const combined = arr1.concat(arr2);          // O(n + m)

// join - array to string
const str = nums.join(',');                 // O(n)
```

**Time Complexity**: O(n) typically  
**Space Complexity**: O(n) for result

---

### Array Sorting

```javascript
// sort - in-place sort
nums.sort((a, b) => a - b);                 // O(n log n)

// reverse - reverse array
nums.reverse();                             // O(n)
```

**Time Complexity**: O(n log n) for sort, O(n) for reverse  
**Space Complexity**: O(1) for in-place operations

---

## String Methods

### Basic Operations

```javascript
const s = "Hello World";

// Length
s.length;                                   // O(1)

// Indexing
s[0];                                       // O(1)
s.charAt(0);                                // O(1)
```

**Time Complexity**: O(1)  
**Space Complexity**: O(1)

---

### String Search

```javascript
// indexOf - find first occurrence
const index = s.indexOf('o');               // O(n)
const index = s.indexOf('World', 5);        // O(n) starting from index

// lastIndexOf - find last occurrence
const lastIndex = s.lastIndexOf('o');        // O(n)

// includes - check if substring exists
const has = s.includes('World');            // O(n*m) where m is pattern length

// startsWith, endsWith
const starts = s.startsWith('Hello');       // O(m)
const ends = s.endsWith('World');          // O(m)
```

**Time Complexity**: O(n) for single char, O(n*m) for substring  
**Space Complexity**: O(1)

---

### String Manipulation

```javascript
// substring - extract portion
const sub = s.substring(0, 5);              // O(k) where k is length

// slice - extract portion (similar to substring)
const sub = s.slice(0, 5);                  // O(k)

// split - string to array
const words = s.split(' ');                 // O(n)

// join - array to string
const joined = words.join(' ');            // O(n)

// toLowerCase, toUpperCase
const lower = s.toLowerCase();              // O(n)
const upper = s.toUpperCase();              // O(n)

// trim - remove whitespace
const trimmed = s.trim();                   // O(n)
```

**Time Complexity**: O(n)  
**Space Complexity**: O(n) - creates new string

---

## Set Operations

```javascript
const set = new Set();

// Operations
set.add(value);                             // O(1) average
set.has(value);                             // O(1) average
set.delete(value);                          // O(1) average
set.size;                                   // O(1)
set.clear();                                // O(n)

// Iteration
for (const value of set) { }                // O(n)
set.forEach(value => { });                  // O(n)
```

**Time Complexity**: O(1) average for add/has/delete  
**Space Complexity**: O(n)

---

## Map Operations

```javascript
const map = new Map();

// Operations
map.set(key, value);                        // O(1) average
map.get(key);                               // O(1) average
map.has(key);                               // O(1) average
map.delete(key);                            // O(1) average
map.size;                                   // O(1)
map.clear();                                // O(n)

// Iteration
for (const [key, value] of map) { }         // O(n)
map.forEach((value, key) => { });          // O(n)
```

**Time Complexity**: O(1) average for set/get/has/delete  
**Space Complexity**: O(n)

---

## Common Patterns

### Two Pointers

```javascript
// Two pointers from both ends
let left = 0;
let right = nums.length - 1;

while (left < right) {
    if (condition) {
        left++;
    } else {
        right--;
    }
}

// Two pointers same direction
let slow = 0;
for (let fast = 0; fast < nums.length; fast++) {
    if (shouldKeep(nums[fast])) {
        nums[slow] = nums[fast];
        slow++;
    }
}
return slow;
```

**Time Complexity**: O(n)  
**Space Complexity**: O(1)

---

### Sliding Window

```javascript
let left = 0;
let maxLength = 0;
const window = new Set();

for (let right = 0; right < s.length; right++) {
    while (window.has(s[right])) {
        window.delete(s[left]);
        left++;
    }
    window.add(s[right]);
    maxLength = Math.max(maxLength, right - left + 1);
}
```

**Time Complexity**: O(n)  
**Space Complexity**: O(k) where k is window size

---

### Binary Search

```javascript
let left = 0;
let right = nums.length - 1;

while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (nums[mid] === target) {
        return mid;
    } else if (nums[mid] < target) {
        left = mid + 1;
    } else {
        right = mid - 1;
    }
}

return -1;
```

**Time Complexity**: O(log n)  
**Space Complexity**: O(1)

---

### Frequency Counting

```javascript
// Using Map
const freq = new Map();
for (const num of nums) {
    freq.set(num, (freq.get(num) || 0) + 1);
}

// Using Object
const freq = {};
for (const num of nums) {
    freq[num] = (freq[num] || 0) + 1;
}
```

**Time Complexity**: O(n)  
**Space Complexity**: O(k) where k is unique elements

---

## Quick Lookup Tables

### Array Method Complexity

| Method | Time | Space | Notes |
|--------|------|-------|-------|
| push/pop | O(1) | O(1) | End of array |
| shift/unshift | O(n) | O(1) | Start of array |
| indexOf/includes | O(n) | O(1) | Search |
| map/filter | O(n) | O(n) | Transform |
| reduce | O(n) | O(1) | Aggregate |
| sort | O(n log n) | O(1) | In-place |
| slice | O(k) | O(k) | k = length |
| splice | O(n) | O(1) | Modify |

---

### String Method Complexity

| Method | Time | Space | Notes |
|--------|------|-------|-------|
| length | O(1) | O(1) | Property |
| indexOf | O(n) | O(1) | Search |
| substring/slice | O(k) | O(k) | k = length |
| includes | O(n*m) | O(1) | m = pattern |
| toLowerCase | O(n) | O(n) | New string |
| split | O(n) | O(n) | Array |
| join | O(n) | O(n) | String |

---

### Set/Map Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| add/set | O(1) avg | O(1) | Average case |
| has/get | O(1) avg | O(1) | Average case |
| delete | O(1) avg | O(1) | Average case |
| size | O(1) | O(1) | Property |
| clear | O(n) | O(1) | Remove all |
| forEach | O(n) | O(1) | Iterate |

---

## Common Mistakes

1. **Using indexOf in loop**: O(n²) - use Set/Map for O(1) lookup
2. **String immutability**: Operations create new strings, use array for many operations
3. **Forgetting to return in map/filter**: Always return value
4. **Modifying array while iterating**: Use indices or create new array
5. **Not handling undefined**: Check for undefined before using Map.get()

---

## TypeScript Specific

### Type Annotations

```typescript
// Arrays
const nums: number[] = [1, 2, 3];
const words: string[] = ['hello', 'world'];

// Sets
const set: Set<number> = new Set();

// Maps
const map: Map<number, number> = new Map();

// Functions
function twoSum(nums: number[], target: number): number[] {
    // Implementation
}
```

---

### Type Safety

```typescript
// Null checks
if (value !== null && value !== undefined) {
    // Use value
}

// Optional chaining
const result = obj?.property?.method?.();

// Non-null assertion (use carefully)
const value = map.get(key)!; // Assumes key exists
```

---

## Interview Tips

1. **Use Set/Map for O(1) lookups**: Don't use indexOf in loops
2. **Understand immutability**: Strings and some array methods create new values
3. **Know your complexities**: Be ready to explain time/space complexity
4. **Use appropriate methods**: map for transform, filter for selection, reduce for aggregation
5. **Handle edge cases**: Empty arrays, null/undefined values

---

**Remember**: This is a quick reference. For detailed pattern explanations, see CORE_ALGORITHM_PATTERNS.md

