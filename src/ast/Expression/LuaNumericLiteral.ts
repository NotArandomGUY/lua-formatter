import { NumericLiteral } from 'luaparse'
import LuaScope from '../LuaScope'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaNumericLiteral extends LuaExpression<'NumericLiteral'> {
  public value: number
  public raw: string

  public constructor(scope: LuaScope) {
    super(scope)

    this.value = 0
    this.raw = ''
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    super.clear()

    this.value = 0
    this.raw = ''

    return this
  }

  public fromJson(obj: NumericLiteral): this {
    super.fromJson(obj)

    const { value, raw } = obj

    this.value = value
    this.raw = raw

    return this
  }

  public toJson(): NumericLiteral {
    const { value, raw } = this

    return Object.assign(super.toJson(), <NumericLiteral>{
      value,
      raw
    })
  }

  public toString(): string {
    const { value } = this

    return `${value}`
  }

  protected visitNested(): void {
    return
  }
}