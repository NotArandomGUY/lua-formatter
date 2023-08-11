import LuaIdentifier from './Expression/LuaIdentifier'
import LuaBase from './LuaBase'
import LuaScope from './LuaScope'

const IS_DEBUG = process.env['LUA_FMT_DEBUG'] === '1'

interface CallInfo<S = object, A extends any[] = object[], R = object> {
  resolve: (ret: R | PromiseLike<R>) => void
  reject: (err: Error) => void
  func: Function
  self: S
  args: A
}

export default class LuaState {
  public scope: LuaScope
  public node: LuaBase
  public stack: LuaScope[]
  public depth: number
  public skip: boolean

  private callQueue: CallInfo[]
  private callTimer: NodeJS.Timer | null
  private callImmediate: number

  public constructor(node: LuaBase) {
    this.scope = node.scope
    this.node = node
    this.stack = []
    this.depth = 0
    this.skip = false

    this.callQueue = []
    this.callTimer = null
    this.callImmediate = 0
  }

  public get globalScope(): LuaScope {
    return this.scope.global
  }

  public push(scope: LuaScope): void {
    if (scope == null) throw new Error('Attempt to push invalid scope')

    this.stack.push(this.scope)
    this.scope = scope
    this.depth = scope.getDepth()

    scope.clear()
  }

  public pop(): void {
    this.scope.clear()

    const scope = this.stack.pop()

    if (scope == null) return

    this.scope = scope
    this.depth = scope.getDepth()
  }

  public async call<S = object, A extends any[] = object[], R = void>(fn: (this: S, ...args: A) => R, self: S, ...args: A): Promise<R> {
    return new Promise((resolve, reject) => {
      const { callQueue, callTimer } = this

      // Push function to call queue
      callQueue.push(<CallInfo>{
        resolve,
        reject,
        func: fn,
        self,
        args
      })

      // Check if immediate call is available
      if (++this.callImmediate <= 32) {
        this.updateCall()
        return
      }

      // Reset immediate call count
      this.callImmediate = 0

      // Check if timer already started
      if (callTimer != null) return

      this.callTimer = setInterval(this.updateCall.bind(this), 1)
    })
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

  public getLastReference(identifier: LuaIdentifier): LuaBase | null {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) return scope.getLastReference(identifier)

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return stackScope.getLastReference(identifier)
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) return null

    return globalScope.getLastReference(identifier)
  }

  public getFirstStatement(identifier: LuaIdentifier): LuaBase | null {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) return scope.getFirstStatement(identifier)

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return stackScope.getFirstStatement(identifier)
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) return null

    return globalScope.getFirstStatement(identifier)
  }

  public getLastStatement(identifier: LuaIdentifier): LuaBase | null {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) return scope.getLastStatement(identifier)

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) return stackScope.getLastStatement(identifier)
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) return null

    return globalScope.getLastStatement(identifier)
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

  public read<T extends LuaBase = LuaBase>(identifier: LuaIdentifier, statement?: LuaBase): T {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) {
      this.debug(`read from current scope[${stack.length}]:`, identifier, 'statement:', statement)
      return scope.read(identifier, statement)!
    }

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      const stackScope = stack[i]

      if (stackScope.isAllocated(identifier)) {
        this.debug(`read from stack scope[${i}]:`, identifier, 'statement:', statement)
        return stackScope.read(identifier, statement)!
      }
    }

    // Global scope
    if (!globalScope.isAllocated(identifier)) globalScope.alloc(identifier)

    this.debug('read from global scope:', identifier, 'statement:', statement)
    return globalScope.read(identifier, statement)!
  }

  public write(identifier: LuaIdentifier, data: LuaBase | null, statement?: LuaBase): boolean {
    const { scope, stack, globalScope } = this

    // Current scope
    if (scope.isAllocated(identifier)) {
      this.debug(`write to current scope[${stack.length}]:`, identifier, 'data:', data)
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
    const padding = IS_DEBUG ? ' '.repeat(this.depth * 2) : ''
    args = args.map(arg => arg?.toString(typeof arg === 'number' ? 10 : 0, true).split('\n')[0] ?? null)

    console.log(`${padding}${msg}`, ...args)
  }

  public debug(msg: string, ...args: any[]): void {
    if (IS_DEBUG) this.log(msg, ...args)
  }

  private updateCall(): void {
    const { callQueue, callTimer } = this

    // Check if call queue is empty
    if (callQueue.length === 0) {
      // Stop timer
      if (callTimer != null) clearInterval(callTimer)
      this.callTimer = null
      return
    }

    for (let i = 0; i < 100; i++) {
      const callInfo = callQueue.shift()

      // Stop if call queue is empty
      if (callInfo == null) break

      const { resolve, reject, func, self, args } = callInfo

      try {
        const ret = func.call(self, ...args)
        if (ret instanceof Promise) {
          ret.then(resolve).catch(reject)
        } else {
          resolve(ret)
        }
      } catch (err) {
        reject(<Error>err)
      }
    }
  }
}