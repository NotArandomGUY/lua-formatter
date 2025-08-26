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
    // Only visit assignment statement
    if (!(node instanceof LuaAssignmentStatement)) return null

    const { scope, variables, init } = node

    // Check if assign statement has more than 1 variable or missing init
    if (variables.length > 1 || init.length === 0) return null

    const varName = variables[0]
    const varInit = init[0]
    const tableInfo = this.getTableConstructor(varName, state)

    // Check if table constructor is valid & scope match
    if (tableInfo == null || tableInfo.statement.scope !== scope) return null

    const { statement, table } = tableInfo

    // Check if value is identifier and table has reference to it
    if (varInit instanceof LuaIdentifier && table.hasReference(varInit)) {
      const readRefCount = state.getStorage(varInit, false)?.getReadRefCount() ?? 0

      // Prevent merging to table constructor if value was reassigned
      // FIXME: maybe ref count is not the best way to do this
      if (readRefCount === 0) return null
    }

    if (varName instanceof LuaIndexExpression) {
      const { index } = varName

      // Check if index is valid
      if (
        !(index instanceof LuaBooleanLiteral) &&
        !(index instanceof LuaNilLiteral) &&
        !(index instanceof LuaNumericLiteral) &&
        !(index instanceof LuaStringLiteral)
      ) return null

      state.log('table assign index:', varName, 'value:', varInit)

      table.assignIndex(varName, varInit)
    } else if (varName instanceof LuaMemberExpression) {
      state.log('table assign member:', varName, 'value:', varInit)

      table.assignMember(varName, varInit)
    } else {
      return null
    }

    // Remove table constructor statement
    this.removeNode(state, statement)

    this.isChanged = true

    // Replace with table constructor statement
    return statement
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

    // Get storage of base identifier from state
    const storage = state.getStorage(base, false)
    if (storage == null) return null

    // Check if base has any read reference
    if (storage.getReadRefCount() > 0) return null

    const lastWriteRef = storage.getLastWriteRef()
    const value = storage.read()

    // Check if write statement & value type is valid
    if (
      (
        lastWriteRef instanceof LuaAssignmentStatement ||
        lastWriteRef instanceof LuaLocalStatement
      ) &&
      value instanceof LuaTableConstructorExpression
    ) return { statement: lastWriteRef, table: value }

    return null
  }
}