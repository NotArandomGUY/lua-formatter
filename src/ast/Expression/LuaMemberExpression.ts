import { MemberExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'
import LuaStringLiteral from './LuaStringLiteral'

export default class LuaMemberExpression extends LuaExpression<'MemberExpression'> {
  public isStatic: boolean
  public base: LuaExpression | null
  public identifier: LuaIdentifier | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.isStatic = true
    this.base = null
    this.identifier = null
  }

  public getReferences(): LuaIdentifier[] {
    const { base, identifier } = this
    const references: LuaIdentifier[] = []

    if (base != null) references.push(...base.getReferences())
    if (identifier != null) references.push(...identifier.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.isStatic = true
    this.base = null
    this.identifier = null

    return this
  }

  public fromJson(obj: MemberExpression): this {
    super.fromJson(obj)

    const { indexer, base, identifier } = obj

    this.isStatic = indexer !== ':'
    this.base = LuaBase.createFromJson(base, this.scope)
    this.identifier = LuaBase.createFromJson(identifier, this.scope)

    return this
  }

  public toJson(): MemberExpression {
    const { isStatic, base, identifier } = this

    if (base == null) throw new Error('Invalid base expression')
    if (identifier == null) throw new Error('Invalid identifier')

    return Object.assign(super.toJson(), <MemberExpression>{
      indexer: isStatic ? '.' : ':',
      base: base.toJson(),
      identifier: identifier.toJson()
    })
  }

  public toString(): string {
    const { isStatic, base, identifier } = this

    if (base == null) throw new Error('Invalid base expression')
    if (identifier == null) throw new Error('Invalid identifier')

    let baseStr = base.toString()

    // Add a pair of parentheses if member is static & base type is literal
    if (isStatic && base instanceof LuaStringLiteral) baseStr = `(${baseStr})`

    return `${baseStr}${isStatic ? '.' : ':'}${identifier.toString()}`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { base, identifier } = this

    this.base = base?.visit(pre, post, postBlock, state) ?? null
    this.identifier = <typeof identifier>identifier?.visit(pre, post, postBlock, state) ?? null
  }
}