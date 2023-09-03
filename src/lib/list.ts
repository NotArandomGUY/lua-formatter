export class ListNode<T>{
  public value: T

  private list: List<T> | null
  private prev: ListNode<T> | null
  private next: ListNode<T> | null

  public constructor(list: List<T> | null, value: T) {
    this.value = value

    this.list = list
    this.prev = null
    this.next = null
  }

  public getList(): List<T> | null {
    return this.list
  }

  public getPrev(): ListNode<T> | null {
    return this.prev
  }

  public getNext(): ListNode<T> | null {
    return this.next
  }

  public insertBefore(node: ListNode<T>): void {
    const { list, prev } = this

    if (list == null || node.list != null) return

    const { head } = list

    node.list = list
    node.prev = prev
    node.next = this
    this.prev = node

    if (head === this) list.head = node

    list.size++
  }

  public insertAfter(node: ListNode<T>): void {
    const { list, next } = this

    if (list == null || node.list != null) return

    const { tail } = list

    node.list = list
    node.prev = this
    node.next = next
    this.next = node

    if (tail === this) list.tail = node

    list.size++
  }

  public removeSelf(): void {
    const { list, prev, next } = this

    if (list == null) return

    const { head, tail } = list

    if (prev != null) prev.next = next
    if (next != null) next.prev = prev

    if (head === this) list.head = next
    if (tail === this) list.tail = prev

    this.list = null
    this.prev = null
    this.next = null

    list.size--
  }
}

export default class List<T> {
  public head: ListNode<T> | null
  public tail: ListNode<T> | null
  public size: number

  public constructor() {
    this.head = null
    this.tail = null
    this.size = 0
  }

  public getNode(pos: number): ListNode<T> | null {
    const { head, tail, size } = this

    if (size <= 0) return null

    if (pos < (size / 2)) {
      // Search from head
      let curNode = head
      for (let i = 0; i < size; i++) {
        if (i === pos) return curNode
        curNode = curNode?.getNext() ?? null
      }
    } else {
      // Search from tail
      let curNode = tail
      for (let i = size - 1; i >= 0; i--) {
        if (i === pos) return curNode
        curNode = curNode?.getPrev() ?? null
      }
    }

    return null
  }

  public getValue(pos: number): T | null {
    return this.getNode(pos)?.value ?? null
  }

  public isEmpty(): boolean {
    return this.head == null
  }

  public indexOf(value: T): number {
    let curNode = this.head
    let curPos = 0

    while (curNode != null) {
      if (curNode.value === value) return curPos

      curNode = curNode.getNext()
      curPos++
    }

    return -1
  }

  public insert(pos: number, value: T): void {
    const { head, tail, size } = this

    if (pos < 0 || size < pos) return

    if (head == null || tail == null) {
      // Head or tail is null, this is the first node
      this.head = this.tail = new ListNode(this, value)
      this.size = 1
      return
    }

    if (pos === size) {
      // Insert after tail node
      tail.insertAfter(new ListNode(null, value))
      return
    }

    const targetNode = this.getNode(pos)

    if (targetNode == null) return

    // Insert before node at position
    targetNode.insertBefore(new ListNode(null, value))
  }

  public remove(pos: number): T | null {
    const node = this.getNode(pos)

    // Check if node exists
    if (node == null) return null

    // Remove node from list
    node.removeSelf()

    return node.value
  }

  public push(...values: T[]): void {
    for (const value of values) {
      this.insert(this.size, value)
    }
  }

  public unshift(...values: T[]): void {
    for (const value of values) {
      this.insert(0, value)
    }
  }

  public pop(): T | null {
    return this.remove(this.size - 1)
  }

  public shift(): T | null {
    return this.remove(0)
  }

  public clear(): void {
    while (this.head != null) {
      this.head.removeSelf()
    }
  }

  public filter(fn: (value: T) => boolean): T[] {
    const values: T[] = []

    let curNode = this.head

    while (curNode != null) {
      const value = curNode.value

      if (fn(value)) values.push(value)

      curNode = curNode.getNext()
    }

    return values
  }

  public map<R>(fn: (value: T) => R): R[] {
    const values: R[] = []

    let curNode = this.head

    while (curNode != null) {
      values.push(fn(curNode.value))

      curNode = curNode.getNext()
    }

    return values
  }

  public toArray(): T[] {
    const values: T[] = []

    let curNode = this.head

    while (curNode != null) {
      values.push(curNode.value)

      curNode = curNode.getNext()
    }

    return values
  }

  public toReversedArray(): T[] {
    const values: T[] = []

    let curNode = this.tail

    while (curNode != null) {
      values.push(curNode.value)

      curNode = curNode.getPrev()
    }

    return values
  }
}