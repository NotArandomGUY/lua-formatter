import { VarargLiteral } from 'luaparse'
import LuaScope from '../LuaScope'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaVarargLiteral extends LuaExpression<'VarargLiteral'> {
  public value: string
  public raw: string

  public constructor(scope: LuaScope) {
    super(scope)

    this.value = ''
    this.raw = ''
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    super.clear()

    this.value = ''
    this.raw = ''

    return this
  }

  public fromJson(obj: VarargLiteral): this {
    super.fromJson(obj)

    const { value, raw } = obj

    this.value = value
    this.raw = raw

    return this
  }

  public toJson(): VarargLiteral {
    const { value, raw } = this

    return Object.assign(super.toJson(), <VarargLiteral>{
      value,
      raw
    })
  }

  public toString(): string {
    const { value } = this

    return value
  }

  protected async visitNested(): Promise<void> {
    return
  }
}