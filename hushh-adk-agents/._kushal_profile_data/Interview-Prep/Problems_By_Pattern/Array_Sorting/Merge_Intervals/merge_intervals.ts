function merge(intervals: number[][]): number[][] {
    if (intervals.length <= 1) return intervals;
    
    // Sort by start time
    intervals.sort((a, b) => a[0] - b[0]);
    
    const merged: number[][] = [intervals[0]];
    
    for (let i = 1; i < intervals.length; i++) {
        const lastMerged = merged[merged.length - 1];
        const current = intervals[i];
        
        if (current[0] <= lastMerged[1]) {
            // Merge
            lastMerged[1] = Math.max(lastMerged[1], current[1]);
        } else {
            // No overlap
            merged.push(current);
        }
    }
    
    return merged;
};
