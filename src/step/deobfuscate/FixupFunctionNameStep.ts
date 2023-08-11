import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaMemberExpression from '@/ast/Expression/LuaMemberExpression'
import LuaBase from '@/ast/LuaBase'
import LuaState from '@/ast/LuaState'
import LuaAssignmentStatement from '@/ast/Statement/LuaAssignmentStatement'
import LuaLocalStatement from '@/ast/Statement/LuaLocalStatement'
import Step from '../Step'

export default class FixupFunctionNameStep extends Step<{}> {
  public constructor(config = {}) {
    super(config)
  }

  protected preVisit(node: LuaBase, state: LuaState): LuaBase | null {
    // Check if type is valid
    if (
      !(node instanceof LuaAssignmentStatement) &&
      !(node instanceof LuaLocalStatement)
    ) return null

    const { scope, variables, init } = node

    // Check if statement has more than 1 variable or missing init
    if (variables.length > 1 || init.length === 0) return null

    const varName = variables[0]
    const varInit = init[0]

    // Check if name & init type is valid
    if (
      (!(varName instanceof LuaIdentifier) && !(varName instanceof LuaMemberExpression)) ||
      !(varInit instanceof LuaFunctionDeclaration)
    ) return null

    const before = node.toString(0, true)

    varInit.identifier = varName
    varInit.isLocal = node instanceof LuaLocalStatement

    state.log('fixup function:', before, '->', varInit)

    state.skip = true

    return varInit.clone(scope)
  }

  protected postVisit(): LuaBase | null {
    return null
  }

  protected postVisitBlock(): LuaBase[] | null {
    return null
  }
}