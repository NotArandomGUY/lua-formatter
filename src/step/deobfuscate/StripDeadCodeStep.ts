import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaBase, { ICodeBlock } from '@/ast/LuaBase'
import LuaScope from '@/ast/LuaScope'
import LuaState from '@/ast/LuaState'
import LuaUtils from '@/ast/LuaUtils'
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
      const firstStatement = scope.getFirstStatement(identifier)
      const lastStatement = scope.getLastStatement(identifier)

      // Dead code condition: not global & no reference & has statement
      if (isGlobal || refCount > 0 || firstStatement == null || lastStatement == null) continue

      // Check if last statement is within loop sice first statement
      if (LuaUtils.isWithinLoop(firstStatement.scope, lastStatement.scope)) continue

      // Check if statement type is valid
      if (
        lastStatement instanceof LuaForGenericStatement ||
        lastStatement instanceof LuaForNumericStatement ||
        lastStatement instanceof LuaFunctionDeclaration
      ) continue

      // Ignore assign statement if it has more than one variable
      if (lastStatement instanceof LuaAssignmentStatement && lastStatement.variables.length > 1) continue

      // Ignore local statement if it has more than one variable with reference
      if (lastStatement instanceof LuaLocalStatement && this.stripLocalStatement(lastStatement, scope, state)) continue

      state.log('found dead code, key:', identifier, 'data:', lastStatement)

      this.removeNode(state, lastStatement)

      // Loop until no more nodes need to be removed
      this.iteration = 1
    }

    return null
  }

  private isScopeValid(scope: LuaScope, identifier: LuaIdentifier, state: LuaState): boolean {
    const statement = state.getLastStatement(identifier) ?? null

    if (statement == null) return true

    let statementScope = statement.scope

    if (statement instanceof LuaFunctionDeclaration) {
      statementScope = statementScope.parent ?? statementScope
    }

    return statementScope.isChild(scope)
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
    const { variables } = node

    for (const varName of variables) {
      // Check if variable is identifier
      if (!(varName instanceof LuaIdentifier)) continue

      const isGlobal = state.isGlobal(varName)
      const refCount = state.getReferenceCount(varName)
      const lastRef = state.getLastReference(varName)
      const statement = state.getLastStatement(varName)

      // Check if variable is global or there are any reference to variable or missing last reference
      if (isGlobal || refCount > 0 || lastRef == null) continue

      // Check if statement type is assign statement
      if (!(statement instanceof LuaAssignmentStatement)) continue

      // Check if statement has more than 1 variable
      if (statement.variables.length > 1) continue

      // Check if scope is valid
      if (!this.isScopeValid(lastRef.scope, varName, state)) continue

      // Remove assign statement
      this.removeNode(state, statement)
    }
  }
}