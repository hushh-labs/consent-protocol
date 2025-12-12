public class Solution {
    public bool IsValid(string s) {
        Stack<char> stack = new Stack<char>();
        
        foreach (char c in s) {
            if (c == '(') {
                stack.Push(')');
            } else if (c == '{') {
                stack.Push('}');
            } else if (c == '[') {
                stack.Push(']');
            } else {
                // If stack is empty or top doesn't match
                if (stack.Count == 0 || stack.Pop() != c) {
                    return false;
                }
            }
        }
        
        return stack.Count == 0;
    }
}
