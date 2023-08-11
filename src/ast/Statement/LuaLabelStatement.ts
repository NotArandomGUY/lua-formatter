import { LabelStatement } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from '../Node/LuaStatement'

export default class LuaLabelStatement extends LuaStatement<'LabelStatement'> {
  public label: LuaIdentifier | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.label = null
  }

  public getReferences(): LuaIdentifier[] {
    return this.label?.getReferences() ?? []
  }

  public clear(): this {
    super.clear()

    this.label = null

    return this
  }

  public fromJson(obj: LabelStatement): this {
    super.fromJson(obj)

    const { label } = obj

    this.label = LuaBase.createFromJson(label, this.scope)

    return this
  }

  public toJson(): LabelStatement {
    const { label } = this

    if (label == null) throw new Error('Invalid label identifier')

    return Object.assign(super.toJson(), <LabelStatement>{
      label: label.toJson()
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, label } = this

    if (label == null) throw new Error('Invalid label identifier')

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    return `${padding}::${label.name}::`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { label } = this

    this.label = <typeof label>label?.visit(pre, post, postBlock, state) ?? null
  }
}