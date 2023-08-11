import { StringCallExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaStringCallExpression extends LuaExpression<'StringCallExpression'> {
  public base: LuaExpression | null
  public argument: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.base = null
    this.argument = null
  }

  public getReferences(): LuaIdentifier[] {
    const { base, argument } = this
    const references: LuaIdentifier[] = []

    if (base != null) references.push(...base.getReferences())
    if (argument != null) references.push(...argument.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.base = null
    this.argument = null

    return this
  }

  public fromJson(obj: StringCallExpression): this {
    super.fromJson(obj)

    const { base, argument } = obj

    this.base = LuaBase.createFromJson(base, this.scope)
    this.argument = LuaBase.createFromJson(argument, this.scope)

    return this
  }

  public toJson(): StringCallExpression {
    const { base, argument } = this

    if (base == null) throw new Error('Invalid base expression')
    if (argument == null) throw new Error('Invalid argument expression')

    return Object.assign(super.toJson(), <StringCallExpression>{
      base: base.toJson(),
      argument: argument.toJson()
    })
  }

  public toString(): string {
    const { base, argument } = this

    console.log(base, argument)

    throw new Error('Method not implemented.')
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { base, argument } = this

    this.base = base?.visit(pre, post, postBlock, state) ?? null
    this.argument = argument?.visit(pre, post, postBlock, state) ?? null
  }
}