import { CallExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaCallExpression extends LuaExpression<'CallExpression'> {
  public base: LuaExpression | null
  public arguments: LuaExpression[]

  public constructor(scope: LuaScope) {
    super(scope)

    this.base = null
    this.arguments = []
  }

  public getReferences(): LuaIdentifier[] {
    const { base, arguments: args } = this
    const references: LuaIdentifier[] = []

    if (base != null) references.push(...base.getReferences())
    for (const arg of args) references.push(...arg.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.base = null
    this.arguments.splice(0)

    return this
  }

  public fromJson(obj: CallExpression): this {
    super.fromJson(obj)

    const { base, arguments: args } = obj

    this.base = LuaBase.createFromJson(base, this.scope)
    this.arguments.push(...args.map(e => LuaBase.createFromJson(e, this.scope)))

    return this
  }

  public toJson(): CallExpression {
    const { base, arguments: args } = this

    if (base == null) throw new Error('Invalid base expression')

    return Object.assign(super.toJson(), <CallExpression>{
      base: base.toJson(),
      arguments: args.map(e => e.toJson())
    })
  }

  public toString(indent = 2): string {
    const { base, arguments: args } = this

    if (base == null) throw new Error('Invalid base expression')

    return `${base.toString()}(${args.map(e => e.toString(indent, true)).join(', ')})`
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { base, arguments: args } = this

    this.base = await base?.visit(pre, post, postBlock, state) ?? null

    for (let i = 0; i < args.length; i++) {
      args[i] = await args[i].visit(pre, post, postBlock, state)
    }
  }
}