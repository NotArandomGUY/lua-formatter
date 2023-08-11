import { BreakStatement } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaScope from '../LuaScope'
import LuaStatement from '../Node/LuaStatement'

export default class LuaBreakStatement extends LuaStatement<'BreakStatement'> {
  public constructor(scope: LuaScope) {
    super(scope)
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    return super.clear()
  }

  public fromJson(obj: BreakStatement): this {
    return super.fromJson(obj)
  }

  public toJson(): BreakStatement {
    return super.toJson()
  }

  public toString(indent = 2, isInline = false): string {
    const { scope } = this

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    return `${padding}break`
  }

  protected async visitNested(): Promise<void> {
    return
  }
}