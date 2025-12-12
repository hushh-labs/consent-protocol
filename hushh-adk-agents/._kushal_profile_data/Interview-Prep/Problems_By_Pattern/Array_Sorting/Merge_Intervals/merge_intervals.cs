public class Solution {
    public int[][] Merge(int[][] intervals) {
        if (intervals.Length <= 1) return intervals;
        
        // Sort by start time
        Array.Sort(intervals, (a, b) => a[0].CompareTo(b[0]));
        
        var merged = new List<int[]> { intervals[0] };
        
        for (int i = 1; i < intervals.Length; i++) {
            var lastMerged = merged[merged.Count - 1];
            var current = intervals[i];
            
            if (current[0] <= lastMerged[1]) {
                // Merge: extend the end
                lastMerged[1] = Math.Max(lastMerged[1], current[1]);
            } else {
                // No overlap: add new interval
                merged.Add(current);
            }
        }
        
        return merged.ToArray();
    }
}
