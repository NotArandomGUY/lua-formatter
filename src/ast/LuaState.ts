import LuaIdentifier from './Expression/LuaIdentifier'
import LuaBase from './LuaBase'
import LuaScope from './LuaScope'
import LuaStorage from './LuaStorage'

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

  public getStorage(identifier: LuaIdentifier, isAutoAlloc: true, debugCallback?: (id: string) => void): LuaStorage
  public getStorage(identifier: LuaIdentifier, isAutoAlloc: false, debugCallback?: (id: string) => void): LuaStorage | null
  public getStorage(identifier: LuaIdentifier, isAutoAlloc: boolean, debugCallback?: (id: string) => void): LuaStorage | null {
    const { scope, stack, globalScope } = this

    let storage: LuaStorage | null

    // Current scope
    storage = scope.getStorage(identifier)
    if (storage != null) {
      debugCallback?.(`current.${stack.length}`)
      return storage
    }

    // Parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      storage = stack[i].getStorage(identifier)
      if (storage == null) continue

      debugCallback?.(`stack.${i}`)
      return storage
    }

    // Global scope
    storage = globalScope.getStorage(identifier)
    if (storage == null) {
      if (!isAutoAlloc) return null

      globalScope.alloc(identifier)

      storage = globalScope.getStorage(identifier)
      if (storage == null) throw new Error('failed to allocate storage to global scope')
    }

    debugCallback?.('global')
    return storage
  }

  public isGlobal(identifier: LuaIdentifier): boolean {
    const { scope, stack } = this

    // Check if allocated at current scope
    if (scope.getStorage(identifier) != null) return false

    // Check if allocated at parent scope
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].getStorage(identifier) != null) return false
    }

    // Not allocated at current/parent scope, must be at global scope
    return true
  }

  public alloc(identifier: LuaIdentifier, isUnknown = false, statement?: LuaBase): boolean {
    return this.scope.alloc(identifier, isUnknown, statement)
  }

  public read<T extends LuaBase = LuaBase>(identifier: LuaIdentifier, statement?: LuaBase): T {
    const storage = this.getStorage(identifier, true, (id) => this.debug(`read from scope[${id}]:`, identifier, 'statement:', statement))

    return storage.read(statement)!
  }

  public write(identifier: LuaIdentifier, value: LuaBase | null, statement?: LuaBase): boolean {
    const storage = this.getStorage(identifier, true, (id) => this.debug(`write to scope[${id}]:`, identifier, 'value:', value, 'statement:', statement))

    return storage.write(value, statement)
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

    for (let i = 0; i < 500; i++) {
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