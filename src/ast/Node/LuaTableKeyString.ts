import { TableKeyString } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from './LuaExpression'

export default class LuaTableKeyString extends LuaBase<'TableKeyString'> {
  public key: LuaIdentifier | null
  public value: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.key = null
    this.value = null
  }

  public getReferences(): LuaIdentifier[] {
    const { key, value } = this
    const references: LuaIdentifier[] = []

    if (key != null) references.push(...key.getReferences())
    if (value != null) references.push(...value.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.key = null
    this.value = null

    return this
  }

  public fromJson(obj: TableKeyString): this {
    super.fromJson(obj)

    const { key, value } = obj

    this.key = LuaBase.createFromJson(key, this.scope)
    this.value = LuaBase.createFromJson(value, this.scope)

    return this
  }

  public toJson(): TableKeyString {
    const { key, value } = this

    if (key == null) throw new Error('Invalid key identifier')
    if (value == null) throw new Error('Invalid value expression')

    return Object.assign(super.toJson(), <TableKeyString>{
      key: key.toJson(),
      value: value.toJson()
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, key, value } = this

    if (key == null) throw new Error('Invalid key identifier')
    if (value == null) throw new Error('Invalid value expression')

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    return `${padding}${key.toString()} = ${value.toString(indent, true)}`
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { key, value } = this

    this.key = <typeof key>(await key?.visit(pre, post, postBlock, state) ?? null)
    this.value = await value?.visit(pre, post, postBlock, state) ?? null
  }
}