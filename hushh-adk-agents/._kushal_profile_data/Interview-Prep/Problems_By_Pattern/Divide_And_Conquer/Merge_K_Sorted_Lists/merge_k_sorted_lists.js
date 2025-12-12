/**
 * Definition for singly-linked list.
 */
function ListNode(val, next) {
    this.val = (val===undefined ? 0 : val)
    this.next = (next===undefined ? null : next)
}

/**
 * OPTIMIZED SOLUTION 1: Divide and Conquer
 * Time: O(N log k)
 * Space: O(1)
 */
var mergeKLists = function(lists) {
    if (!lists || lists.length === 0) return null;
    
    let interval = 1;
    while (interval < lists.length) {
        for (let i = 0; i + interval < lists.length; i = i + interval * 2) {
            lists[i] = mergeTwoLists(lists[i], lists[i + interval]);
        }
        interval *= 2;
    }
    
    return lists[0];
};

// Helper function to merge two sorted lists
function mergeTwoLists(l1, l2) {
    let dummy = new ListNode(0);
    let current = dummy;
    
    while (l1 && l2) {
        if (l1.val <= l2.val) {
            current.next = l1;
            l1 = l1.next;
        } else {
            current.next = l2;
            l2 = l2.next;
        }
        current = current.next;
    }
    
    if (l1) current.next = l1;
    if (l2) current.next = l2;
    
    return dummy.next;
}

/**
 * OPTIMIZED SOLUTION 2: Min-Heap (Priority Queue)
 * Time: O(N log k)
 * Space: O(k)
 * 
 * Note: JavaScript doesn't have a built-in PriorityQueue, so we implement a simple MinHeap.
 */
var mergeKLists_MinHeap = function(lists) {
    const minHeap = new MinHeap();
    
    // Add first node of each list to the heap
    for (let list of lists) {
        if (list) {
            minHeap.push(list);
        }
    }
    
    let dummy = new ListNode(0);
    let current = dummy;
    
    while (!minHeap.isEmpty()) {
        let minNode = minHeap.pop();
        current.next = minNode;
        current = current.next;
        
        if (minNode.next) {
            minHeap.push(minNode.next);
        }
    }
    
    return dummy.next;
};

class MinHeap {
    constructor() {
        this.heap = [];
    }
    
    push(val) {
        this.heap.push(val);
        this.bubbleUp(this.heap.length - 1);
    }
    
    pop() {
        if (this.isEmpty()) return null;
        const min = this.heap[0];
        const last = this.heap.pop();
        if (!this.isEmpty()) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return min;
    }
    
    isEmpty() {
        return this.heap.length === 0;
    }
    
    bubbleUp(index) {
        while (index > 0) {
            let parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].val <= this.heap[index].val) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }
    
    bubbleDown(index) {
        while (true) {
            let leftChild = 2 * index + 1;
            let rightChild = 2 * index + 2;
            let smallest = index;
            
            if (leftChild < this.heap.length && this.heap[leftChild].val < this.heap[smallest].val) {
                smallest = leftChild;
            }
            if (rightChild < this.heap.length && this.heap[rightChild].val < this.heap[smallest].val) {
                smallest = rightChild;
            }
            
            if (smallest === index) break;
            
            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }
}
