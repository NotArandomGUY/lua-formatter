import { Base } from 'luaparse'
import type ASTMap from './ASTMap'
import LuaIdentifier from './Expression/LuaIdentifier'
import LuaScope from './LuaScope'
import LuaState from './LuaState'
import LuaStatement from './Node/LuaStatement'

export type PreVisitCallback = ((node: LuaBase, state: LuaState) => LuaBase | null) | null
export type PostVisitCallback = ((node: LuaBase, state: LuaState) => LuaBase | null) | null
export type PostVisitBlockCallback = ((node: LuaBase & ICodeBlock, state: LuaState) => LuaBase[] | null) | null

export interface ICodeBlock {
  body: LuaStatement[]

  getStatementByType<TType extends keyof typeof ASTMap, TAst extends typeof LuaStatement<TType>>(type: TAst): InstanceType<TAst>[]
}

export interface ILocationInfo {
  line: number
  column: number
}

export default abstract class LuaBase<TType extends keyof typeof ASTMap = keyof typeof ASTMap> {
  private static ASTMap: typeof ASTMap | null = null

  public static async init(): Promise<void> {
    this.ASTMap = (await import('./ASTMap')).default
  }

  public static createFromJson<TType extends keyof typeof ASTMap, TAst extends InstanceType<typeof ASTMap[TType]>>(obj: Base<TType>, scope?: LuaScope): TAst {
    if (this.ASTMap == null) throw new Error('ASTMap not initialized')

    const ASTCtor = this.ASTMap[obj.type]

    // ASTCtor will be null/undefined if type is invalid/not supported,
    // throw an error if that's the case
    if (ASTCtor == null) throw new Error(`Invalid AST type: ${obj.type}`)

    // Create a new AST instance
    const ast = new (<new (scope?: LuaScope) => TAst><unknown>ASTCtor)(scope)

    // Parse object and return AST instance
    return <TAst>ast.fromJson(<any>obj)
  }

  public scope: LuaScope

  public type: TType
  public location: { start: ILocationInfo, end: ILocationInfo } | null

  public constructor(scope?: LuaScope) {
    this.scope = scope ?? new LuaScope(this)

    this.type = <TType>(Object.entries(LuaBase.ASTMap ?? {}).find(e => this.constructor === e[1])?.[0] ?? '')
    this.location = null
  }

  public abstract getReferences(): LuaIdentifier[]

  public hasReference(identifier: LuaIdentifier): boolean {
    return this.getReferences().find(i => i.isMatch(identifier)) != null
  }

  public clear(): this {
    this.location = null

    return this
  }

  public clone(scope?: LuaScope): this {
    return <this>LuaBase.createFromJson(this.toJson(), scope)
  }

  public visit(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState = new LuaState(this)): LuaBase {
    try {
      let node: LuaBase = this

      // Execute pre visit callback
      if (typeof pre === 'function') {
        state.skip = false
        node = pre(node, state) ?? node

        if (state.skip) {
          state.skip = false
          return node
        }
      }

      // Visit nested
      this.visitNested(pre, post, postBlock, state)

      // Execute post visit callback
      if (typeof post === 'function') {
        node = post(node, state) ?? node
      }

      return node
    } catch (err) {
      console.log('error node:', this)
      throw err
    }
  }

  public fromJson(obj: Base<TType>): this {
    this.clear()

    const { loc } = obj

    this.location = loc ?? null

    return this
  }

  public toJson(): Base<TType> {
    const { type, location } = this

    return {
      type,
      loc: location ?? undefined
    }
  }

  public abstract toString(indent?: number, isInline?: boolean): string

  protected abstract visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void
}