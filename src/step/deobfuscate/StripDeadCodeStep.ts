import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaBase, { ICodeBlock } from '@/ast/LuaBase'
import LuaScope from '@/ast/LuaScope'
import LuaState from '@/ast/LuaState'
import LuaElseClause from '@/ast/Node/LuaElseClause'
import LuaElseifClause from '@/ast/Node/LuaElseifClause'
import LuaIfClause from '@/ast/Node/LuaIfClause'
import LuaAssignmentStatement from '@/ast/Statement/LuaAssignmentStatement'
import LuaForGenericStatement from '@/ast/Statement/LuaForGenericStatement'
import LuaForNumericStatement from '@/ast/Statement/LuaForNumericStatement'
import LuaLocalStatement from '@/ast/Statement/LuaLocalStatement'
import Step from '../Step'

export default class StripDeadCodeStep extends Step<{}> {
  public constructor(config = {}) {
    super(config)
  }

  protected preVisit(node: LuaBase, state: LuaState): LuaBase | null {
    if (node instanceof LuaAssignmentStatement) this.visitPreAssignmentStatement(node, state)

    return null
  }

  protected postVisit(): LuaBase | null {
    return null
  }

  protected postVisitBlock(node: LuaBase & ICodeBlock, state: LuaState): LuaBase[] | null {
    const { scope } = node

    const keys = scope.getKeys()

    for (const key of keys) {
      const identifier = new LuaIdentifier(scope)

      identifier.name = key

      const isGlobal = state.isGlobal(identifier)
      const refCount = scope.getReferenceCount(identifier)
      const statement = scope.getStatement(identifier)

      // Dead code condition: not global & no reference & has statement
      if (isGlobal || refCount > 0 || statement == null) continue

      // Check if statement type is valid
      if (
        statement instanceof LuaForGenericStatement ||
        statement instanceof LuaForNumericStatement ||
        statement instanceof LuaFunctionDeclaration
      ) continue

      // Ignore assign statement if it has more than one variable
      if (statement instanceof LuaAssignmentStatement && statement.variables.length > 1) continue

      // Ignore local statement if it has more than one variable with reference
      if (statement instanceof LuaLocalStatement && this.stripLocalStatement(statement, scope, state)) continue

      state.log('found dead code, key:', identifier, 'data:', statement)

      this.removeNode(state, statement)

      // Loop until no more nodes need to be removed
      this.iteration = 1
    }

    return null
  }

  private stripLocalStatement(node: LuaLocalStatement, scope: LuaScope, state: LuaState): boolean {
    const { variables } = node

    const removeVariables = variables.filter(v => scope.getReferenceCount(v) === 0)

    // Check if all variables will be stripped
    if (variables.length === removeVariables.length) return false

    // Remove all local variables with 0 reference
    while (removeVariables.length > 0) {
      const variable = removeVariables.shift()!

      state.log('strip local variable:', variable, 'statement:', node)

      variables.splice(variables.indexOf(variable), 1)
    }

    return true
  }

  private visitPreAssignmentStatement(node: LuaAssignmentStatement, state: LuaState): void {
    const { scope, variables } = node

    for (const varName of variables) {
      // Check if variable is identifier
      if (!(varName instanceof LuaIdentifier)) continue

      const isGlobal = state.isGlobal(varName)
      const refCount = state.getReferenceCount(varName)
      const statement = state.getStatement(varName)

      // Check if variable is global or there are any reference to variable
      if (isGlobal || refCount > 0) continue

      // Check if statement is valid
      if (
        !(statement instanceof LuaLocalStatement) &&
        !(statement instanceof LuaAssignmentStatement)
      ) continue

      // Check if statement has more than 1 variable
      if (statement.variables.length > 1) continue

      const parentNode = scope.node

      // Check if scope is valid
      if (
        // Check if scope is within last assign statement scope
        !statement.scope.isChild(scope) ||
        // Check for conditional statement
        (
          (
            parentNode instanceof LuaElseClause ||
            parentNode instanceof LuaElseifClause ||
            parentNode instanceof LuaFunctionDeclaration ||
            parentNode instanceof LuaIfClause
          ) &&
          scope.isParent(statement.scope)
        )
      ) continue

      // Remove assign statement
      this.removeNode(state, statement)
    }
  }
}