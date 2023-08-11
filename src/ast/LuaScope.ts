import LuaIdentifier from './Expression/LuaIdentifier'
import LuaBase from './LuaBase'

export default class LuaScope {
  public static allocValue: (new (scope: LuaScope) => LuaBase) | null = null

  public global: LuaScope
  public parent: LuaScope | null
  public node: LuaBase

  private storageMap: Map<string, LuaBase | null>
  private referenceMap: Map<string, number>
  private statementMap: Map<string, LuaBase>

  public constructor(node: LuaBase, parent?: LuaScope | false) {
    this.global = parent === false ? this : (parent?.global ?? new LuaScope(node, false))
    this.parent = parent === false ? null : (parent ?? null)
    this.node = node

    this.storageMap = new Map()
    this.referenceMap = new Map()
    this.statementMap = new Map()
  }

  public getDepth(): number {
    let node: LuaScope | null = this
    let depth = -1

    while (node != null) {
      node = node.parent
      depth++
    }

    return depth
  }

  public getKeys(): string[] {
    return Array.from(this.referenceMap.keys())
  }

  public getReferenceCount(identifier: LuaIdentifier): number {
    return this.referenceMap.get(identifier.name) ?? 0
  }

  public getStatement(identifier: LuaIdentifier): LuaBase | null {
    return this.statementMap.get(identifier.name) ?? null
  }

  public isAllocated(identifier: LuaIdentifier): boolean {
    return this.referenceMap.has(identifier.name)
  }

  public isUnknown(identifier: LuaIdentifier): boolean {
    return this.isAllocated(identifier) && this.storageMap.get(identifier.name) == null
  }

  /**
   * Return true if scope is child of this scope or is this scope
   * @param scope Child or this scope
   * @returns Is child or self
   */
  public isChild(scope: LuaScope): boolean {
    let curScope: LuaScope | null = scope

    while (curScope != null) {
      if (curScope === this) return true

      curScope = curScope.parent
    }

    return false
  }

  /**
   * Return true if scope is parent of this scope
   * @param scope Parent scope
   * @returns Is parent
   */
  public isParent(scope: LuaScope): boolean {
    return scope !== this && scope.isChild(this)
  }

  public alloc(identifier: LuaIdentifier, isUnknown = false, statement?: LuaBase): boolean {
    const { storageMap, referenceMap, statementMap } = this
    const { name } = identifier

    const isRedefined = this.isAllocated(identifier)

    if (LuaScope.allocValue == null) throw new Error('Allocate value unset')

    storageMap.set(name, isUnknown ? null : new LuaScope.allocValue(this))
    referenceMap.set(name, 0)

    if (statement != null) statementMap.set(name, statement)

    return isRedefined
  }

  public read<T extends LuaBase = LuaBase>(identifier: LuaIdentifier, isTrack = false): T | null {
    const { storageMap, referenceMap } = this
    const { name } = identifier

    if (!this.isAllocated(identifier)) return null

    // Increase reference count if enabled tracking
    if (isTrack) referenceMap.set(name, referenceMap.get(name)! + 1)

    return <T | null>(storageMap.get(name) ?? null)
  }

  public write(identifier: LuaIdentifier, data: LuaBase | null, statement?: LuaBase): boolean {
    const { storageMap, referenceMap, statementMap } = this
    const { name } = identifier

    if (!this.isAllocated(identifier)) return false

    storageMap.set(name, data)
    referenceMap.set(name, 0)

    if (statement != null) statementMap.set(name, statement)
    return true
  }

  public free(identifier: LuaIdentifier): boolean {
    const { storageMap, referenceMap, statementMap } = this
    const { name } = identifier

    if (!this.isAllocated(identifier)) return false

    storageMap.delete(name)
    referenceMap.delete(name)
    statementMap.delete(name)
    return true
  }

  public clear(): void {
    const { storageMap, referenceMap, statementMap } = this

    storageMap.clear()
    referenceMap.clear()
    statementMap.clear()
  }
}