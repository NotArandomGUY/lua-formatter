import LuaIdentifier from './Expression/LuaIdentifier'
import LuaBase from './LuaBase'
import LuaScope from './LuaScope'

const IS_DEBUG = process.env['LUA_FMT_DEBUG'] === '1'

export default class LuaState {
  public scope: LuaScope
  public node: LuaBase
  public stack: LuaScope[]
  public depth: number
  public skip: boolean

  public constructor(node: LuaBase) {
    this.scope = node.scope
    this.node = node
    this.stack = []
    this.depth = 0
    this.skip = false
  }

  public get globalScope(): LuaScope {
    return this.scope.global
  }

  public push(scope: LuaScope): void {
    if (scope == null) throw new Error('Attempt to push invalid scope')

    this.stack.push(this.scope)
    this.scope = scope
    this.depth = scope.getDepth()
  }

  public pop(): void {
    this.scope.clear()

    const scope = this.stack.pop()

    if (scope == null) return

    this.scope = scope
    this.depth = scope.getDepth()
  }

  public getKeys(): string[] {
    const { scope, stack, globalScope } = this

    const keys: string[] = []

    // Current scope
    keys.push(...scope.getKeys())

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      keys.push(...stack[i].getKeys())
    }

    // Global scope
    keys.push(...globalScope.getKeys())

    // Return deduplicated keys
    return keys.filter((k, i) => keys.indexOf(k) === i)
  }

  public getReferenceCount(identifier: LuaIdentifier): number {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) return scope.getReferenceCount(identifier)

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return stackScope.getReferenceCount(identifier)
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) return 0

    return globalScope.getReferenceCount(identifier)
  }

  public getStatement(identifier: LuaIdentifier): LuaBase | null {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) return scope.getStatement(identifier)

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return stackScope.getStatement(identifier)
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) return null

    return globalScope.getStatement(identifier)
  }

  public isAllocated(identifier: LuaIdentifier): boolean {
    const { scope, stack, globalScope } = this

    // Check if allocated at current scope
    if (scope.isAllocated(identifier)) return true

    // Check if allocated at parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return true
    }

    // Check if allocated at global scope
    return globalScope.isAllocated(identifier)
  }

  public isGlobal(identifier: LuaIdentifier): boolean {
    const { scope, stack } = this

    // Check if allocated at current scope
    if (scope.isAllocated(identifier)) return false

    // Check if allocated at parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return false
    }

    // Not allocated at current/parent scope, must be at global scope
    return true
  }

  public isUnknown(identifier: LuaIdentifier): boolean {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) return scope.isUnknown(identifier)

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return stackScope.isUnknown(identifier)
    }

    // Global scope
    return globalScope.isUnknown(identifier)
  }

  public alloc(identifier: LuaIdentifier, isUnknown = false, statement?: LuaBase): boolean {
    return this.scope.alloc(identifier, isUnknown, statement)
  }

  public read<T extends LuaBase = LuaBase>(identifier: LuaIdentifier, isTrack = false): T {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) {
      this.debug('read from current scope:', identifier, 'track:', isTrack)
      return scope.read(identifier, isTrack)!
    }

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) {
        this.debug(`read from stack scope[${i}]:`, identifier, 'track:', isTrack)
        return stackScope.read(identifier, isTrack)!
      }
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) globalScope.alloc(identifier)

    this.debug('read from global scope:', identifier, 'track:', isTrack)
    return globalScope.read(identifier, isTrack)!
  }

  public write(identifier: LuaIdentifier, data: LuaBase | null, statement?: LuaBase): boolean {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) {
      this.debug('write to current scope:', identifier, 'data:', data)
      return scope.write(identifier, data, statement)
    }

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) {
        this.debug(`write to stack scope[${i}]:`, identifier, 'data:', data)
        return stackScope.write(identifier, data, statement)
      }
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) globalScope.alloc(identifier, true, statement)

    this.debug('write to global scope:', identifier, 'data:', data)
    return globalScope.write(identifier, data, statement)
  }

  public log(msg: string, ...args: any[]): void {
    args = args.map(arg => arg?.toString(typeof arg === 'number' ? 10 : 0, true).split('\n')[0] ?? null)
    console.log(`${' '.repeat(this.depth * 2)}${msg}`, ...args)
  }

  public debug(msg: string, ...args: any[]): void {
    if (IS_DEBUG) this.log(msg, ...args)
  }
}