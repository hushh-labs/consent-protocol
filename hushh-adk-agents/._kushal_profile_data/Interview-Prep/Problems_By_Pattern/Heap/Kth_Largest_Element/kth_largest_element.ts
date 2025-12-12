function findKthLargest(nums: number[], k: number): number {
    // Simple sort approach - O(N log N)
    nums.sort((a, b) => b - a);
    return nums[k - 1];
};

// Heap approach with sorted array
function findKthLargestHeap(nums: number[], k: number): number {
    const heap: number[] = [];
    
    for (const num of nums) {
        heap.push(num);
        heap.sort((a, b) => a - b);
        
        if (heap.length > k) {
            heap.shift();
        }
    }
    
    return heap[0];
};
