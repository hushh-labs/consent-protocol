/**
 * Definition for singly-linked list.
 */
class ListNode {
    val: number
    next: ListNode | null
    constructor(val?: number, next?: ListNode | null) {
        this.val = (val===undefined ? 0 : val)
        this.next = (next===undefined ? null : next)
    }
}

// Approach: Divide and Conquer
// Time: O(N log k)
// Space: O(1)
function mergeKLists(lists: Array<ListNode | null>): ListNode | null {
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

function mergeTwoLists(l1: ListNode | null, l2: ListNode | null): ListNode | null {
    let dummy = new ListNode(0);
    let current = dummy;
    
    while (l1 !== null && l2 !== null) {
        if (l1.val <= l2.val) {
            current.next = l1;
            l1 = l1.next;
        } else {
            current.next = l2;
            l2 = l2.next;
        }
        current = current.next;
    }
    
    if (l1 !== null) current.next = l1;
    if (l2 !== null) current.next = l2;
    
    return dummy.next;
}

// Approach: Min-Heap (Priority Queue)
// Time: O(N log k)
// Space: O(k)
function mergeKLists_MinHeap(lists: Array<ListNode | null>): ListNode | null {
    const minHeap = new MinHeap();
    
    for (let list of lists) {
        if (list) {
            minHeap.push(list);
        }
    }
    
    let dummy = new ListNode(0);
    let current = dummy;
    
    while (!minHeap.isEmpty()) {
        let minNode = minHeap.pop();
        if (minNode) {
            current.next = minNode;
            current = current.next;
            
            if (minNode.next) {
                minHeap.push(minNode.next);
            }
        }
    }
    
    return dummy.next;
}

class MinHeap {
    private heap: ListNode[];

    constructor() {
        this.heap = [];
    }
    
    push(val: ListNode) {
        this.heap.push(val);
        this.bubbleUp(this.heap.length - 1);
    }
    
    pop(): ListNode | null {
        if (this.isEmpty()) return null;
        const min = this.heap[0];
        const last = this.heap.pop();
        if (!this.isEmpty() && last) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return min;
    }
    
    isEmpty(): boolean {
        return this.heap.length === 0;
    }
    
    private bubbleUp(index: number) {
        while (index > 0) {
            let parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].val <= this.heap[index].val) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }
    
    private bubbleDown(index: number) {
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
