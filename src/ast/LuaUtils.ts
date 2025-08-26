import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaScope from './LuaScope'
import LuaForGenericStatement from './Statement/LuaForGenericStatement'
import LuaForNumericStatement from './Statement/LuaForNumericStatement'
import LuaRepeatStatement from './Statement/LuaRepeatStatement'
import LuaWhileStatement from './Statement/LuaWhileStatement'

export default class LuaUtils {
  public static isWithinFunction(parentScope: LuaScope, childScope: LuaScope): boolean {
    if (!parentScope.isChild(childScope)) return false

    let curScope: LuaScope | null = childScope

    while (curScope != null && curScope !== parentScope) {
      const curNode = curScope.node

      if (curNode instanceof LuaFunctionDeclaration) return true

      curScope = curScope.parent
    }

    return false
  }

  public static isWithinLoop(parentScope: LuaScope, childScope: LuaScope): boolean {
    if (!parentScope.isChild(childScope)) return false

    let curScope: LuaScope | null = childScope

    while (curScope != null && curScope !== parentScope) {
      const curNode = curScope.node

      if (
        curNode instanceof LuaForGenericStatement ||
        curNode instanceof LuaForNumericStatement ||
        curNode instanceof LuaRepeatStatement ||
        curNode instanceof LuaWhileStatement
      ) return true

      curScope = curScope.parent
    }

    return false
  }
}