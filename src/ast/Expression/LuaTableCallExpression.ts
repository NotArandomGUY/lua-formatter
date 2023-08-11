import { TableCallExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaTableCallExpression extends LuaExpression<'TableCallExpression'> {
  public base: LuaExpression | null
  public arguments: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.base = null
    this.arguments = null
  }

  public getReferences(): LuaIdentifier[] {
    const { base, arguments: args } = this
    const references: LuaIdentifier[] = []

    if (base != null) references.push(...base.getReferences())
    if (args != null) references.push(...args.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.base = null
    this.arguments = null

    return this
  }

  public fromJson(obj: TableCallExpression): this {
    super.fromJson(obj)

    const { base, arguments: args } = obj

    this.base = LuaBase.createFromJson(base, this.scope)
    this.arguments = LuaBase.createFromJson(args, this.scope)

    return this
  }

  public toJson(): TableCallExpression {
    const { base, arguments: args } = this

    if (base == null) throw new Error('Invalid base expression')
    if (args == null) throw new Error('Invalid arguments expression')

    return Object.assign(super.toJson(), <TableCallExpression>{
      base: base.toJson(),
      arguments: args.toJson()
    })
  }

  public toString(): string {
    const { base, arguments: args } = this

    console.log(base, args)

    throw new Error('Method not implemented.')
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { base, arguments: args } = this

    this.base = base?.visit(pre, post, postBlock, state) ?? null
    this.arguments = args?.visit(pre, post, postBlock, state) ?? null
  }
}