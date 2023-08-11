import { TableValue } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from './LuaExpression'

export default class LuaTableValue extends LuaBase<'TableValue'> {
  public value: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.value = null
  }

  public getReferences(): LuaIdentifier[] {
    return this.value?.getReferences() ?? []
  }

  public clear(): this {
    super.clear()

    this.value = null

    return this
  }

  public fromJson(obj: TableValue): this {
    super.fromJson(obj)

    const { value } = obj

    this.value = LuaBase.createFromJson(value, this.scope)

    return this
  }

  public toJson(): TableValue {
    const { value } = this

    if (value == null) throw new Error('Invalid value expression')

    return Object.assign(super.toJson(), <TableValue>{
      value: value.toJson()
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, value } = this

    if (value == null) throw new Error('Invalid value expression')

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    return `${padding}${value.toString(indent, true)}`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { value } = this

    this.value = value?.visit(pre, post, postBlock, state) ?? null
  }
}