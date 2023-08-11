import { ReturnStatement } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaStatement from '../Node/LuaStatement'

export default class LuaReturnStatement extends LuaStatement<'ReturnStatement'> {
  public arguments: LuaExpression[]

  public constructor(scope: LuaScope) {
    super(scope)

    this.arguments = []
  }

  public getReferences(): LuaIdentifier[] {
    const { arguments: args } = this
    const references: LuaIdentifier[] = []

    for (const arg of args) references.push(...arg.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.arguments.splice(0)

    return this
  }

  public fromJson(obj: ReturnStatement): this {
    super.fromJson(obj)

    const { arguments: args } = obj

    this.arguments.push(...args.map(s => LuaBase.createFromJson(s, this.scope)))

    return this
  }

  public toJson(): ReturnStatement {
    const { arguments: args } = this

    return Object.assign(super.toJson(), <ReturnStatement>{
      arguments: args.map(e => e.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, arguments: args } = this

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    if (args.length === 0) return `${padding}return`

    return `${padding}return ${args.map(e => e.toString(indent, true)).join(', ')}`
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { arguments: args } = this

    for (let i = 0; i < args.length; i++) {
      args[i] = await args[i].visit(pre, post, postBlock, state)
    }
  }
}