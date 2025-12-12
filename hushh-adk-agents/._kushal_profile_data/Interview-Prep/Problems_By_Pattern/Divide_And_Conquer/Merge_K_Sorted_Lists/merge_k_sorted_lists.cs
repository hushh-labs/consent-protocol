/**
 * Definition for singly-linked list.
 */
public class ListNode {
    public int val;
    public ListNode next;
    public ListNode(int val=0, ListNode next=null) {
        this.val = val;
        this.next = next;
    }
}
public class Solution {
    // Approach: Divide and Conquer
    // Time: O(N log k)
    // Space: O(1)
    public ListNode MergeKLists(ListNode[] lists) {
        if (lists == null || lists.Length == 0) return null;
        
        int interval = 1;
        while (interval < lists.Length) {
            for (int i = 0; i + interval < lists.Length; i += interval * 2) {
                lists[i] = MergeTwoLists(lists[i], lists[i + interval]);
            }
            interval *= 2;
        }
        
        return lists[0];
    }
    
    private ListNode MergeTwoLists(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode(0);
        ListNode current = dummy;
        
        while (l1 != null && l2 != null) {
            if (l1.val <= l2.val) {
                current.next = l1;
                l1 = l1.next;
            } else {
                current.next = l2;
                l2 = l2.next;
            }
            current = current.next;
        }
        
        if (l1 != null) current.next = l1;
        if (l2 != null) current.next = l2;
        
        return dummy.next;
    }

    // Approach: Min-Heap (Priority Queue)
    // Time: O(N log k)
    // Space: O(k)
    // Note: Requires .NET 6+ for PriorityQueue
    public ListNode MergeKLists_MinHeap(ListNode[] lists) {
        if (lists == null || lists.Length == 0) return null;

        // PriorityQueue<Element, Priority> - ordered by Priority (val)
        var pq = new PriorityQueue<ListNode, int>();

        foreach (var list in lists) {
            if (list != null) {
                pq.Enqueue(list, list.val);
            }
        }

        ListNode dummy = new ListNode(0);
        ListNode current = dummy;

        while (pq.Count > 0) {
            ListNode minNode = pq.Dequeue();
            current.next = minNode;
            current = current.next;

            if (minNode.next != null) {
                pq.Enqueue(minNode.next, minNode.next.val);
            }
        }

        return dummy.next;
    }
}
