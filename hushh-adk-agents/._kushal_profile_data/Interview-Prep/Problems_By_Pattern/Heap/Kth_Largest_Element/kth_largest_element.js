/**
 * Min Heap Implementation (for JavaScript)
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  size() {
    return this.heap.length;
  }

  peek() {
    return this.heap[0];
  }

  push(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return min;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex] <= this.heap[index]) break;

      [this.heap[parentIndex], this.heap[index]] = [
        this.heap[index],
        this.heap[parentIndex],
      ];
      index = parentIndex;
    }
  }

  _bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild] < this.heap[smallest]
      ) {
        smallest = leftChild;
      }
      if (
        rightChild < this.heap.length &&
        this.heap[rightChild] < this.heap[smallest]
      ) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[index],
      ];
      index = smallest;
    }
  }
}

/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number}
 *
 * OPTIMAL APPROACH: Min Heap (WITHOUT sorting!)
 * - Maintain min heap of size k
 * - Heap root is the kth largest element
 * - Time: O(N log k)
 * - Space: O(k)
 */
var findKthLargest = function (nums, k) {
  const minHeap = new MinHeap();

  for (const num of nums) {
    minHeap.push(num);

    // Maintain heap size k
    if (minHeap.size() > k) {
      minHeap.pop(); // Remove smallest
    }
  }

  // Smallest in heap of k largest = kth largest
  return minHeap.peek();
};

// Example usage:
// console.log(findKthLargest([3,2,1,5,6,4], 2)); // 5
// console.log(findKthLargest([3,2,3,1,2,4,5,5,6], 4)); // 4
