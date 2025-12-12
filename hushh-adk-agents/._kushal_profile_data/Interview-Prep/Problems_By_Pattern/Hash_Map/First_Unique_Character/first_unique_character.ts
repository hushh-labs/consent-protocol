function firstUniqChar(s: string): number {
    const countMap: { [key: string]: number } = {};
    
    // First pass: Count frequencies
    for (let i = 0; i < s.length; i++) {
        const char = s[i];
        countMap[char] = (countMap[char] || 0) + 1;
    }
    
    // Second pass: Find first unique character
    for (let i = 0; i < s.length; i++) {
        if (countMap[s[i]] === 1) {
            return i;
        }
    }
    
    return -1;
};
