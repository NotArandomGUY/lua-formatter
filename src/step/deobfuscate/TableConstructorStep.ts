import LuaBooleanLiteral from '@/ast/Expression/LuaBooleanLiteral'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaIndexExpression from '@/ast/Expression/LuaIndexExpression'
import LuaMemberExpression from '@/ast/Expression/LuaMemberExpression'
import LuaNilLiteral from '@/ast/Expression/LuaNilLiteral'
import LuaNumericLiteral from '@/ast/Expression/LuaNumericLiteral'
import LuaStringLiteral from '@/ast/Expression/LuaStringLiteral'
import LuaTableConstructorExpression from '@/ast/Expression/LuaTableConstructorExpression'
import LuaBase, { ICodeBlock } from '@/ast/LuaBase'
import LuaState from '@/ast/LuaState'
import LuaAssignmentStatement from '@/ast/Statement/LuaAssignmentStatement'
import LuaLocalStatement from '@/ast/Statement/LuaLocalStatement'
import Step from '../Step'

export default class TableConstructorStep extends Step<{}> {
  public constructor(config = {}) {
    super(config)
  }

  protected preVisit(node: LuaBase, state: LuaState): LuaBase | null {
    // Check if type is valid
    if (!(node instanceof LuaAssignmentStatement)) return null

    const { scope, variables, init } = node

    // Check if assign statement has more than 1 variable or missing init
    if (variables.length > 1 || init.length === 0) return null

    const varName = variables[0]
    const varInit = init[0]
    const tableInfo = this.getTableConstructor(varName, state)

    // Check if table constructor is valid
    if (tableInfo == null) return null

    const { statement, table } = tableInfo

    if (varName instanceof LuaIndexExpression) {
      const { index } = varName

      // Check if index is valid
      if (
        !(index instanceof LuaBooleanLiteral) &&
        !(index instanceof LuaNilLiteral) &&
        !(index instanceof LuaNumericLiteral) &&
        !(index instanceof LuaStringLiteral)
      ) return null

      table.assignIndex(varName, varInit)
    } else if (varName instanceof LuaMemberExpression) {
      table.assignMember(varName, varInit)
    } else {
      return null
    }

    // Remove table constructor statement
    this.removeNode(state, statement)

    // Replace with table constructor statement
    return statement.clone(scope)
  }

  protected postVisit(node: LuaBase, state: LuaState): LuaBase | null {
    return null
  }

  protected postVisitBlock(node: LuaBase & ICodeBlock, state: LuaState): LuaBase[] | null {
    return null
  }

  private getTableConstructor(node: LuaBase, state: LuaState): { statement: LuaAssignmentStatement | LuaLocalStatement, table: LuaTableConstructorExpression } | null {
    // Check if node type is valid
    if (!(node instanceof LuaIndexExpression) && !(node instanceof LuaMemberExpression)) return null

    const { base } = node

    // Check if base type is identifier
    if (!(base instanceof LuaIdentifier)) return null

    const statement = state.getStatement(base)
    const value = state.read(base)

    // Check if statement & value type is valid
    if (
      (
        statement instanceof LuaAssignmentStatement ||
        statement instanceof LuaLocalStatement
      ) &&
      value instanceof LuaTableConstructorExpression
    ) return { statement, table: value }

    return null
  }
}