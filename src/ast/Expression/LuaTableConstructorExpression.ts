import { TableConstructorExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaTableKey from '../Node/LuaTableKey'
import LuaTableKeyString from '../Node/LuaTableKeyString'
import LuaTableValue from '../Node/LuaTableValue'
import LuaIdentifier from './LuaIdentifier'
import LuaIndexExpression from './LuaIndexExpression'
import LuaMemberExpression from './LuaMemberExpression'

export default class LuaTableConstructorExpression extends LuaExpression<'TableConstructorExpression'> {
  public fields: (LuaTableKey | LuaTableKeyString | LuaTableValue)[]

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.fields = []
  }

  public getReferences(): LuaIdentifier[] {
    const { fields } = this
    const references: LuaIdentifier[] = []

    for (const field of fields) references.push(...field.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.fields.splice(0)

    return this
  }

  public assignIndex(ast: LuaIndexExpression, value: LuaBase): void {
    const { scope, fields } = this
    const { index } = ast

    if (index == null) throw new Error('Invalid index expression')

    const field = new LuaTableKey(scope)

    field.key = index
    field.value = value

    fields.push(field)
  }

  public assignMember(ast: LuaMemberExpression, value: LuaBase): void {
    const { scope, fields } = this
    const { identifier } = ast

    if (identifier == null) throw new Error('Invalid identifier')

    const field = new LuaTableKeyString(scope)

    field.key = identifier
    field.value = value

    fields.push(field)
  }

  public fromJson(obj: TableConstructorExpression): this {
    super.fromJson(obj)

    const { fields } = obj

    this.fields.push(...fields.map(f => LuaBase.createFromJson(f, this.scope)))

    return this
  }

  public toJson(): TableConstructorExpression {
    const { fields } = this

    return Object.assign(super.toJson(), <TableConstructorExpression>{
      fields: fields.map(f => f.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, fields } = this

    const padding = ' '.repeat(indent * (scope.getDepth() - 1))

    if (fields.length === 0) return `${isInline ? '' : padding}{}`

    return `${isInline ? '' : padding}{\n${fields.map(f => f.toString(indent)).join(',\n')}\n${padding}}`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { fields } = this

    for (let i = 0; i < fields.length; i++) {
      fields[i] = <typeof fields[0]>fields[i].visit(pre, post, postBlock, state)
    }
  }
}