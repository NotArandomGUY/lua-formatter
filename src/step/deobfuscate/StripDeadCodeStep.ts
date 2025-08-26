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

      // Get storage of identifier from scope
      const storage = scope.getStorage(identifier)
      if (storage == null) continue

      const isGlobal = state.isGlobal(identifier)
      const readRefCount = storage.getReadRefCount()
      const firstWriteRef = storage.getFirstWriteRef()
      const lastWriteRef = storage.getLastWriteRef()

      // Dead code condition: not global & no read reference & has write reference
      if (isGlobal || readRefCount > 0 || firstWriteRef == null || lastWriteRef == null) continue

      // Check if last write statement is within loop after first write statement
      if (LuaUtils.isWithinLoop(firstWriteRef.scope, lastWriteRef.scope)) continue

      // Check if write statement type is valid
      if (
        lastWriteRef instanceof LuaForGenericStatement ||
        lastWriteRef instanceof LuaForNumericStatement ||
        lastWriteRef instanceof LuaFunctionDeclaration
      ) continue

      // Ignore assign statement if it has more than one variable
      if (lastWriteRef instanceof LuaAssignmentStatement && lastWriteRef.variables.length > 1) continue

      // Ignore local statement if it has more than one variable with reference
      if (lastWriteRef instanceof LuaLocalStatement && this.stripLocalStatement(lastWriteRef, scope, state)) continue

      state.log('found dead code, key:', identifier, 'data:', lastWriteRef)

      this.removeNode(state, lastWriteRef)

      // Loop until no more nodes need to be removed
      this.iteration = 1
    }

    return null
  }

  private isScopeValid(scope: LuaScope, identifier: LuaIdentifier, state: LuaState): boolean {
    const statement = state.getStorage(identifier, false)?.getLastWriteRef() ?? null
    if (statement == null) return true

    let statementScope = statement.scope

    if (statement instanceof LuaFunctionDeclaration) {
      statementScope = statementScope.parent ?? statementScope
    }

    return statementScope.isChild(scope)
  }

  private stripLocalStatement(node: LuaLocalStatement, scope: LuaScope, state: LuaState): boolean {
    const { variables } = node

    const removeVariables = variables.filter(v => (scope.getStorage(v)?.getReadRefCount() ?? 0) === 0)

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

      // Get storage of variable from state
      const storage = state.getStorage(varName, false)
      if (storage == null) continue

      const isGlobal = state.isGlobal(varName)
      const readRefCount = storage.getReadRefCount()
      const lastReadRef = storage.getLastReadRef()
      const lastWriteRef = storage.getLastWriteRef()

      // Check if variable was local and there are no read references
      if (isGlobal || readRefCount > 0 || lastReadRef == null) continue

      // Check if write statement type is assign statement
      if (!(lastWriteRef instanceof LuaAssignmentStatement)) continue

      // Check if assign statement has exactly 1 variable
      if (lastWriteRef.variables.length > 1) continue

      // Check if scope is valid
      if (!this.isScopeValid(lastReadRef.scope, varName, state)) continue

      // Remove previous assign statement
      this.removeNode(state, lastWriteRef)
    }
  }
}