public class Solution {
    // Approach 1: Simple Sort
    public int FindKthLargest(int[] nums, int k) {
        Array.Sort(nums);
        return nums[nums.Length - k];
    }
    
    // Approach 2: Min Heap (using PriorityQueue in .NET 6+)
    public int FindKthLargestHeap(int[] nums, int k) {
        // C# has PriorityQueue (min heap by default)
        var minHeap = new PriorityQueue<int, int>();
        
        foreach (int num in nums) {
            minHeap.Enqueue(num, num);
            
            // Maintain size k
            if (minHeap.Count > k) {
                minHeap.Dequeue();
            }
        }
        
        // Smallest in heap = kth largest overall
        return minHeap.Peek();
    }
}
