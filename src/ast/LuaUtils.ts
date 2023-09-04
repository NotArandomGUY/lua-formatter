import LuaScope from './LuaScope'
import LuaForGenericStatement from './Statement/LuaForGenericStatement'
import LuaForNumericStatement from './Statement/LuaForNumericStatement'
import LuaRepeatStatement from './Statement/LuaRepeatStatement'
import LuaWhileStatement from './Statement/LuaWhileStatement'

export default class LuaUtils {
  public static isWithinLoop(srcScope: LuaScope, dstScope: LuaScope): boolean {
    if (!srcScope.isChild(dstScope)) return false

    let curScope: LuaScope | null = dstScope

    while (curScope != null && curScope !== srcScope) {
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