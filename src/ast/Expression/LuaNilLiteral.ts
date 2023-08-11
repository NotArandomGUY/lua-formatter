import { NilLiteral } from 'luaparse'
import LuaScope from '../LuaScope'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaNilLiteral extends LuaExpression<'NilLiteral'> {
  public value: null
  public raw: string

  public constructor(scope: LuaScope) {
    super(scope)

    this.value = null
    this.raw = ''
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    super.clear()

    this.value = null
    this.raw = ''

    return this
  }

  public fromJson(obj: NilLiteral): this {
    super.fromJson(obj)

    const { value, raw } = obj

    this.value = value
    this.raw = raw

    return this
  }

  public toJson(): NilLiteral {
    const { value, raw } = this

    return Object.assign(super.toJson(), <NilLiteral>{
      value,
      raw
    })
  }

  public toString(): string {
    return 'nil'
  }

  protected async visitNested(): Promise<void> {
    return
  }
}

LuaScope.allocValue = LuaNilLiteral