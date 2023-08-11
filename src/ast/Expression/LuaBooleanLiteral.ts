import { BooleanLiteral } from 'luaparse'
import LuaScope from '../LuaScope'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaBooleanLiteral extends LuaExpression<'BooleanLiteral'> {
  public value: boolean
  public raw: string

  public constructor(scope: LuaScope) {
    super(scope)

    this.value = false
    this.raw = ''
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    super.clear()

    this.value = false
    this.raw = ''

    return this
  }

  public fromJson(obj: BooleanLiteral): this {
    super.fromJson(obj)

    const { value, raw } = obj

    this.value = value
    this.raw = raw

    return this
  }

  public toJson(): BooleanLiteral {
    const { value, raw } = this

    return Object.assign(super.toJson(), <BooleanLiteral>{
      value,
      raw
    })
  }

  public toString(): string {
    const { value } = this

    return value ? 'true' : 'false'
  }

  protected visitNested(): void {
    return
  }
}