import LuaIdentifier from './Expression/LuaIdentifier'
import LuaBase from './LuaBase'
import LuaStorage from './LuaStorage'

export default class LuaScope {
  public static allocValue: (new (scope: LuaScope) => LuaBase) | null = null

  public global: LuaScope
  public parent: LuaScope | null
  public node: LuaBase

  private storageMap: Map<string, LuaStorage>

  public constructor(node: LuaBase, parent?: LuaScope | false) {
    this.global = parent === false ? this : (parent?.global ?? new LuaScope(node, false))
    this.parent = parent === false ? null : (parent ?? null)
    this.node = node

    this.storageMap = new Map()
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
    return Array.from(this.storageMap.keys())
  }

  public getStorage(identifier: LuaIdentifier): LuaStorage | null {
    const { storageMap } = this
    const { name } = identifier

    return storageMap.get(name) ?? null
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
    if (LuaScope.allocValue == null) throw new Error('Allocate value unset')

    const { storageMap } = this
    const { name } = identifier

    const isRedefined = storageMap.has(name)

    storageMap.set(name, new LuaStorage(isUnknown ? null : new LuaScope.allocValue(this), statement))

    return !isRedefined
  }

  public read<T extends LuaBase = LuaBase>(identifier: LuaIdentifier, statement?: LuaBase): T | null {
    const { storageMap } = this
    const { name } = identifier

    return storageMap.get(name)?.read<T>(statement) ?? null
  }

  public write(identifier: LuaIdentifier, value: LuaBase | null, statement?: LuaBase): boolean {
    const { storageMap } = this
    const { name } = identifier

    return storageMap.get(name)?.write(value, statement) ?? false
  }

  public free(identifier: LuaIdentifier): boolean {
    const { storageMap } = this
    const { name } = identifier

    return storageMap.delete(name)
  }

  public clear(): void {
    const { storageMap } = this

    storageMap.clear()
  }
}