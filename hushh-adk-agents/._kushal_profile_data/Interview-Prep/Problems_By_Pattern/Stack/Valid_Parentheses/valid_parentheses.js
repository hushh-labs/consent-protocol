/**
 * @param {string} s
 * @return {boolean}
 */
var isValid = function(s) {
    // Stack to keep track of opening brackets
    let stack = [];
    
    // Map for easy lookup of matching pairs
    const map = {
        ')': '(',
        '}': '{',
        ']': '['
    };

    for (let i = 0; i < s.length; i++) {
        const char = s[i];
        
        // If it's a closing bracket
        if (map[char]) {
            // Pop the top element (or use dummy value if empty)
            const topElement = stack.length === 0 ? '#' : stack.pop();
            
            // If the popped element doesn't match the corresponding opening bracket
            if (topElement !== map[char]) {
                return false;
            }
        } else {
            // It's an opening bracket, push to stack
            stack.push(char);
        }
    }

    // If stack is empty, all brackets were matched
    return stack.length === 0;
};
