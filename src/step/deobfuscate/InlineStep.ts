import LuaBinaryExpression from '@/ast/Expression/LuaBinaryExpression'
import LuaCallExpression from '@/ast/Expression/LuaCallExpression'
import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaIndexExpression from '@/ast/Expression/LuaIndexExpression'
import LuaMemberExpression from '@/ast/Expression/LuaMemberExpression'
import LuaStringCallExpression from '@/ast/Expression/LuaStringCallExpression'
import LuaTableCallExpression from '@/ast/Expression/LuaTableCallExpression'
import LuaTableConstructorExpression from '@/ast/Expression/LuaTableConstructorExpression'
import LuaUnaryExpression from '@/ast/Expression/LuaUnaryExpression'
import LuaBase, { ICodeBlock } from '@/ast/LuaBase'
import LuaScope from '@/ast/LuaScope'
import LuaState from '@/ast/LuaState'
import LuaUtils from '@/ast/LuaUtils'
import LuaElseifClause from '@/ast/Node/LuaElseifClause'
import LuaExpression from '@/ast/Node/LuaExpression'
import LuaIfClause from '@/ast/Node/LuaIfClause'
import LuaStatement from '@/ast/Node/LuaStatement'
import LuaTableKey from '@/ast/Node/LuaTableKey'
import LuaTableKeyString from '@/ast/Node/LuaTableKeyString'
import LuaTableValue from '@/ast/Node/LuaTableValue'
import LuaAssignmentStatement from '@/ast/Statement/LuaAssignmentStatement'
import LuaForGenericStatement from '@/ast/Statement/LuaForGenericStatement'
import LuaForNumericStatement from '@/ast/Statement/LuaForNumericStatement'
import LuaLocalStatement from '@/ast/Statement/LuaLocalStatement'
import LuaRepeatStatement from '@/ast/Statement/LuaRepeatStatement'
import LuaReturnStatement from '@/ast/Statement/LuaReturnStatement'
import LuaWhileStatement from '@/ast/Statement/LuaWhileStatement'
import Step from '../Step'

export default class InlineStep extends Step<{}> {
  private inlineNodes: [LuaBase, LuaStatement][]

  public constructor(config = {}) {
    super(config)

    this.inlineNodes = []
  }

  protected preVisit(node: LuaBase, state: LuaState): LuaBase | null { // NOSONAR
    if (node instanceof LuaAssignmentStatement) this.visitPreAssignmentStatement(node, state)
    else if (node instanceof LuaBinaryExpression) this.visitPreBinaryExpression(node, state)
    else if (node instanceof LuaCallExpression) this.visitPreCallExpression(node, state)
    else if (node instanceof LuaElseifClause) this.visitConditionStatement(node, state)
    else if (node instanceof LuaForGenericStatement) this.visitPreForGenericStatement(node, state)
    else if (node instanceof LuaForNumericStatement) this.visitPreForNumericStatement(node, state)
    else if (node instanceof LuaFunctionDeclaration) this.visitPreFunctionDeclaration(node, state)
    else if (node instanceof LuaIfClause) this.visitConditionStatement(node, state)
    else if (node instanceof LuaIndexExpression) this.visitPreIndexExpression(node, state)
    else if (node instanceof LuaMemberExpression) this.visitPreBaseExpression(node, state)
    else if (node instanceof LuaReturnStatement) this.visitPreReturnStatement(node, state)
    else if (node instanceof LuaStringCallExpression) this.visitPreBaseExpression(node, state)
    else if (node instanceof LuaTableCallExpression) this.visitPreBaseExpression(node, state)
    else if (node instanceof LuaTableKey) this.visitPreTableKey(node, state)
    else if (node instanceof LuaTableKeyString) this.visitPreTableValue(node, state)
    else if (node instanceof LuaTableValue) this.visitPreTableValue(node, state)
    else if (node instanceof LuaUnaryExpression) this.visitPreUnaryExpression(node, state)
    else if (node instanceof LuaWhileStatement) this.visitConditionStatement(node, state)

    return null
  }

  protected postVisit(node: LuaBase, state: LuaState): LuaBase | null {
    if (node instanceof LuaRepeatStatement) this.visitConditionStatement(node, state)

    return null
  }

  protected postVisitBlock(node: LuaBase & ICodeBlock, state: LuaState): LuaBase[] | null {
    const { scope } = node

    const keys = scope.getKeys()

    for (const key of keys) {
      const identifier = new LuaIdentifier(scope)

      identifier.name = key

      this.checkIdentifierInline(identifier, state)
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

  private isStatementAwaitInline(statement: LuaStatement): boolean {
    return this.inlineNodes.find(i => i[1] === statement) != null
  }

  private addInlineNode(node: LuaBase, statement: LuaStatement, state: LuaState): void {
    const { inlineNodes } = this

    if (inlineNodes.find(i => i[0] === node && i[1] === statement)) return

    state.debug('add inline node:', node, 'statement:', statement)
    inlineNodes.push([node, statement])

    this.iteration = 1
  }

  private consumeInlineNode(node: LuaBase, statement: LuaStatement, state: LuaState): boolean {
    const { inlineNodes } = this

    const info = inlineNodes.find(i => i[0] === node && i[1] === statement)
    if (info == null) return false

    state.debug('consume inline node:', node, 'statement:', statement)
    inlineNodes.splice(inlineNodes.indexOf(info), 1)

    this.iteration = 1
    return true
  }

  private checkIdentifierInline(identifier: LuaIdentifier, state: LuaState): void {
    const { scope } = identifier

    // Get storage of identifier from identifier scope
    const storage = scope.getStorage(identifier)
    if (storage == null) {
      state.debug('missing storage in identifier scope, identifier:', identifier)
      return
    }

    const isGlobal = state.isGlobal(identifier)
    const readRefCount = storage.getReadRefCount()
    const lastReadRef = storage.getLastReadRef()
    const lastWriteRef = storage.getLastWriteRef()

    // Inline condition: not global & has exactly 1 read reference & has write reference
    if (isGlobal || readRefCount !== 1 || lastReadRef == null || lastWriteRef == null) {
      state.debug('inline condition not match, identifier:', identifier, 'global:', isGlobal, 'readRef:', readRefCount, lastReadRef, 'writeRef:', lastWriteRef)
      return
    }

    // Check if write statement type is local or assign statement
    if (!(lastWriteRef instanceof LuaLocalStatement) && !(lastWriteRef instanceof LuaAssignmentStatement)) {
      // Check if write statement type is function declaration & scope is not within function
      if (!(lastWriteRef instanceof LuaFunctionDeclaration) || scope === lastWriteRef.scope) return

      state.debug('inline function, identifier:', identifier, 'global:', isGlobal, 'readRef:', readRefCount, lastReadRef, 'writeRef:', lastWriteRef)

      this.addInlineNode(lastWriteRef, lastReadRef, state)
      return
    }

    const { variables, init } = lastWriteRef

    // Ignore if write statement has more than one variable or missing init
    if (variables.length > 1 || init.length === 0) return

    // Check if scope is valid
    if (!this.isScopeValid(lastReadRef.scope, identifier, state)) return

    state.debug('inline assign, identifier:', identifier, 'global:', isGlobal, 'readRef:', readRefCount, lastReadRef, 'writeRef:', lastWriteRef)

    this.addInlineNode(init[0], lastReadRef, state)
  }

  private inlinePrevIdentifier(identifier: LuaIdentifier, state: LuaState): void {
    // Get storage of identifier from state
    const storage = state.getStorage(identifier, false)
    if (storage == null) {
      state.debug('missing storage in state, identifier:', identifier)
      return
    }

    const isGlobal = state.isGlobal(identifier)
    const readRefCount = storage.getReadRefCount()
    const lastReadRef = storage.getLastReadRef()
    const lastWriteRef = storage.getLastWriteRef()

    // Add previous value as inline node if variable is reassigned with exactly 1 read reference
    // Inline condition: not global & has exactly 1 read reference & has write reference
    if (isGlobal || readRefCount !== 1 || lastReadRef == null || lastWriteRef == null) return

    // Check if write statement type is local or assign statement
    if (lastWriteRef instanceof LuaLocalStatement || lastWriteRef instanceof LuaAssignmentStatement) {
      const { variables, init } = lastWriteRef

      const varName = variables[0]
      const varInit = init[0]

      // Check if type is valid and init do not reference itself
      if (
        varName != null &&
        varInit != null &&
        (!(varName instanceof LuaIdentifier) || !varInit.hasReference(varName))
      ) {
        this.addInlineNode(varInit, lastReadRef, state)
        return
      }
    }

    // Check if write statement type is function declaration
    if (lastWriteRef instanceof LuaFunctionDeclaration) {
      this.addInlineNode(lastWriteRef, lastReadRef, state)
    }
  }

  private resolveIdentifiers(identifiers: LuaBase[], state: LuaState): void {
    for (let i = 0; i < identifiers.length; i++) {
      const identifier = identifiers[i]

      // Check if identifier type is valid
      if (!(identifier instanceof LuaIdentifier)) continue

      // Get storage of identifier from state
      const storage = state.getStorage(identifier, false)
      if (storage == null) continue

      const lastWriteRef = storage.getLastWriteRef()

      // Check if identifier has statement & type is local or assign statement
      if (!(lastWriteRef instanceof LuaLocalStatement || lastWriteRef instanceof LuaAssignmentStatement)) continue

      const { variables } = lastWriteRef
      const section = identifiers.slice(i, i + variables.length)

      // Check if statement has more than 1 variables & identifiers size is valid &
      // Check if variables & identifiers type is valid
      if (
        variables.length <= 1 || section.length !== variables.length ||
        variables.find(variable => !(variable instanceof LuaIdentifier)) || section.find(identifier => !(identifier instanceof LuaIdentifier))
      ) continue

      state.debug('try resolve identifiers:', identifiers.map(i => i.toString()).join(', '), 'variables:', variables.map(v => v.toString()).join(', '))

      // Check if identifiers match
      if (variables.find((variable, j) => !(<LuaIdentifier>variable).isMatch(<LuaIdentifier>section[j]))) continue

      // Remove assign statement
      if (!(lastWriteRef instanceof LuaLocalStatement) || lastWriteRef.variables.length === variables.length) this.removeNode(state, lastWriteRef)

      // Get value of variable
      const value = state.read(identifier)

      state.log('resolve identifiers:', variables.map(variable => variable.toString()).join(', '), '->', value)

      // Replace identifiers with value
      identifiers.splice(i, variables.length, value)
    }
  }

  private resolveInline<T extends LuaBase | null>(node: LuaBase, identifier: T, state: LuaState, filter: (typeof LuaBase<any>)[], ignoreLoop: boolean): T {
    const { scope } = node

    // Check if type is identifier
    if (!(identifier instanceof LuaIdentifier)) return identifier

    // Get storage of identifier from state
    const storage = state.getStorage(identifier, false)
    if (storage == null) return identifier

    // Check if variable is local or value is not unknown
    if (state.isGlobal(identifier) || storage.isUnknown()) return identifier

    // Get value of variable
    let value = state.read(identifier)

    // Check if value type is valid & not waiting for inline
    if (filter.find(type => value instanceof type) != null || this.isStatementAwaitInline(value)) return identifier

    // Check if scope is valid
    if (!this.isScopeValid(node.scope, identifier, state)) return identifier

    // Get assign statement
    const lastWriteRef = storage.getLastWriteRef()

    // Avoid resolve in loop statement unless ignored
    if (!ignoreLoop && lastWriteRef != null && LuaUtils.isWithinLoop(lastWriteRef.scope, scope)) return identifier

    // Check if assign statement has exactly 1 variables
    if (
      (lastWriteRef instanceof LuaAssignmentStatement || lastWriteRef instanceof LuaLocalStatement) &&
      lastWriteRef.variables.length !== 1
    ) return identifier

    // Try to consume inline node
    if (!this.consumeInlineNode(value, node, state)) return identifier

    // Remove assign statement
    if (!(lastWriteRef instanceof LuaLocalStatement)) this.removeNode(state, lastWriteRef)

    state.log('resolve inline:', identifier, '->', value)

    this.isChanged = true

    // Clone value
    value = value.clone(node.scope)

    // Strip function identifier
    if (value instanceof LuaFunctionDeclaration) value.identifier = null

    return <T>value
  }

  private resolveReassign<T extends LuaBase | null>(node: LuaBase, identifier: T, variable: LuaIdentifier, state: LuaState, excludeTypes: (typeof LuaBase<any>)[]): T {
    const { scope } = node

    // Check if type is identifier
    if (!(identifier instanceof LuaIdentifier)) return identifier

    // Get storage of identifier from state
    const storage = state.getStorage(identifier, false)
    if (storage == null) return identifier

    // Check if value is not unknown
    if (storage.isUnknown()) return identifier

    // Check if identifier is reference to variable & this is the first reference to it
    if (!identifier.isMatch(variable) || storage.getReadRefCount() > 0) return identifier

    // Get the value of the variable
    let value = state.read(identifier)

    // Check if value type is not excluded & not waiting for inline
    if (excludeTypes.find(type => value instanceof type) != null || this.isStatementAwaitInline(value)) return identifier

    // Check if scope is valid
    if (!this.isScopeValid(scope, identifier, state)) return identifier

    // Get assign statement
    const lastWriteRef = storage.getLastWriteRef()

    // Avoid resolve in loop statement
    if (lastWriteRef != null && LuaUtils.isWithinLoop(lastWriteRef.scope, scope)) return identifier

    // Check if assign statement has exactly 1 variables
    if (
      (lastWriteRef instanceof LuaAssignmentStatement || lastWriteRef instanceof LuaLocalStatement) &&
      lastWriteRef.variables.length !== 1
    ) return identifier

    // Consume inline node if exists
    this.consumeInlineNode(value, node, state)

    // Remove assign statement
    if (!(lastWriteRef instanceof LuaLocalStatement)) this.removeNode(state, lastWriteRef)

    state.log('resolve reassign:', identifier, '->', value)

    this.isChanged = true

    // Clone value to scope
    value = value.clone(scope)

    // Strip function identifier
    if (value instanceof LuaFunctionDeclaration) value.identifier = null

    return <T>value
  }

  private visitConditionStatement(node: LuaElseifClause | LuaIfClause | LuaRepeatStatement | LuaWhileStatement, state: LuaState): void {
    node.condition = this.resolveInline(node, node.condition, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
  }

  private visitPreAssignmentStatement(node: LuaAssignmentStatement, state: LuaState): void {
    const { variables, init } = node

    for (let i = 0; i < variables.length; i++) {
      const varName = variables[i]
      const varInit = this.resolveInline(node, init[i], state, [], false)

      if (init[i] !== varInit) init[i] = varInit

      if (varName instanceof LuaIdentifier) this.visitPreIdentifierAssignment(varName, varInit ?? init[0], state)
    }
  }

  private visitPreBinaryExpression(node: LuaBinaryExpression, state: LuaState): void {
    const { left, right } = node

    node.left = this.resolveInline(node, left, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
    node.right = this.resolveInline(node, right, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
  }

  private visitPreCallExpression(node: LuaCallExpression, state: LuaState): void {
    const { base, arguments: args } = node

    node.base = this.resolveInline(node, base, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)

    this.resolveIdentifiers(args, state)

    for (let i = 0; i < args.length; i++) {
      args[i] = this.resolveInline(node, args[i], state, [], false)
    }
  }

  private visitPreForGenericStatement(node: LuaForGenericStatement, state: LuaState): void {
    const { iterators } = node

    this.resolveIdentifiers(iterators, state)
  }

  private visitPreForNumericStatement(node: LuaForNumericStatement, state: LuaState): void {
    const { start, end, step } = node

    node.start = this.resolveInline(node, start, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], true)
    node.end = this.resolveInline(node, end, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], true)
    node.step = this.resolveInline(node, step, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], true)
  }

  private visitPreFunctionDeclaration(node: LuaFunctionDeclaration, state: LuaState): void {
    const { identifier } = node

    // Check if function has identifier & type is valid
    if (identifier == null || !(identifier instanceof LuaIdentifier)) return

    this.inlinePrevIdentifier(identifier, state)
  }

  private visitPreIdentifierAssignment(identifier: LuaIdentifier, init: LuaExpression, state: LuaState): void {
    this.inlinePrevIdentifier(identifier, state)

    if (init instanceof LuaBinaryExpression) {
      this.reassignBinaryExpression(init, identifier, state)
    } else if (init instanceof LuaCallExpression) {
      this.reassignCallBase(init, identifier, state)
      this.reassignCallExpression(init, identifier, state)
    } else if (init instanceof LuaIndexExpression) {
      this.reassignIndexExpression(init, identifier, state)
    } else if (init instanceof LuaMemberExpression) {
      this.reassignMemberExpression(init, identifier, state)
    } else if (init instanceof LuaStringCallExpression) {
      this.reassignCallBase(init, identifier, state)
    } else if (init instanceof LuaTableCallExpression) {
      this.reassignCallBase(init, identifier, state)
    } else if (init instanceof LuaUnaryExpression) {
      this.reassignUnaryExpression(init, identifier, state)
    }
  }

  private visitPreIndexExpression(node: LuaIndexExpression, state: LuaState): void {
    const { base, index } = node

    node.base = this.resolveInline(node, base, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
    node.index = this.resolveInline(node, index, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
  }

  private visitPreBaseExpression(node: LuaMemberExpression | LuaStringCallExpression | LuaTableCallExpression, state: LuaState): void {
    node.base = this.resolveInline(node, node.base, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
  }

  private visitPreReturnStatement(node: LuaReturnStatement, state: LuaState): void {
    const { arguments: args } = node

    this.resolveIdentifiers(args, state)

    for (let i = 0; i < args.length; i++) {
      args[i] = this.resolveInline(node, args[i], state, [], false)
    }
  }

  private visitPreTableKey(node: LuaTableKey, state: LuaState): void {
    const { key, value } = node

    node.key = this.resolveInline(node, key, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
    node.value = this.resolveInline(node, value, state, [], false)
  }

  private visitPreTableValue(node: LuaTableKeyString | LuaTableValue, state: LuaState): void {
    node.value = this.resolveInline(node, node.value, state, [], false)
  }

  private visitPreUnaryExpression(node: LuaUnaryExpression, state: LuaState): void {
    node.argument = this.resolveInline(node, node.argument, state, [LuaFunctionDeclaration, LuaTableConstructorExpression], false)
  }

  private reassignBinaryExpression(node: LuaBinaryExpression, variable: LuaIdentifier, state: LuaState): void {
    const { left, right } = node

    node.left = this.resolveReassign(node, left, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
    node.right = this.resolveReassign(node, right, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
  }

  private reassignCallBase(node: LuaCallExpression | LuaStringCallExpression | LuaTableCallExpression, variable: LuaIdentifier, state: LuaState): void {
    const { base } = node

    if (base instanceof LuaIndexExpression) {
      this.reassignIndexExpression(base, variable, state)
    } else if (base instanceof LuaMemberExpression) {
      this.reassignMemberExpression(base, variable, state)
    } else {
      node.base = this.resolveReassign(node, base, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
    }
  }

  private reassignCallExpression(node: LuaCallExpression, variable: LuaIdentifier, state: LuaState): void {
    const { arguments: args } = node

    for (let i = 0; i < args.length; i++) {
      args[i] = this.resolveReassign(node, args[i], variable, state, [])
    }
  }

  private reassignIndexExpression(node: LuaIndexExpression, variable: LuaIdentifier, state: LuaState): void {
    const { base, index } = node

    node.base = this.resolveReassign(node, base, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
    node.index = this.resolveReassign(node, index, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
  }

  private reassignMemberExpression(node: LuaMemberExpression, variable: LuaIdentifier, state: LuaState): void {
    node.base = this.resolveReassign(node, node.base, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
  }

  private reassignUnaryExpression(node: LuaUnaryExpression, variable: LuaIdentifier, state: LuaState): void {
    node.argument = this.resolveReassign(node, node.argument, variable, state, [LuaFunctionDeclaration, LuaTableConstructorExpression])
  }
}