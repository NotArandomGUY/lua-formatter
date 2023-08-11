import { IndexExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaIndexExpression extends LuaExpression<'IndexExpression'> {
  public base: LuaExpression | null
  public index: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.base = null
    this.index = null
  }

  public getReferences(): LuaIdentifier[] {
    const { base, index } = this
    const references: LuaIdentifier[] = []

    if (base != null) references.push(...base.getReferences())
    if (index != null) references.push(...index.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.base = null
    this.index = null

    return this
  }

  public fromJson(obj: IndexExpression): this {
    super.fromJson(obj)

    const { base, index } = obj

    this.base = LuaBase.createFromJson(base, this.scope)
    this.index = LuaBase.createFromJson(index, this.scope)

    return this
  }

  public toJson(): IndexExpression {
    const { base, index } = this

    if (base == null) throw new Error('Invalid base expression')
    if (index == null) throw new Error('Invalid index expression')

    return Object.assign(super.toJson(), <IndexExpression>{
      base: base.toJson(),
      index: index.toJson()
    })
  }

  public toString(): string {
    const { base, index } = this

    if (base == null) throw new Error('Invalid base expression')
    if (index == null) throw new Error('Invalid index expression')

    return `${base.toString()}[${index.toString()}]`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { base, index } = this

    this.base = base?.visit(pre, post, postBlock, state) ?? null
    this.index = index?.visit(pre, post, postBlock, state) ?? null
  }
}