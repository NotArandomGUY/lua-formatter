import LuaBinaryExpression from '@/ast/Expression/LuaBinaryExpression'
import LuaBooleanLiteral from '@/ast/Expression/LuaBooleanLiteral'
import LuaCallExpression from '@/ast/Expression/LuaCallExpression'
import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaIndexExpression from '@/ast/Expression/LuaIndexExpression'
import LuaMemberExpression from '@/ast/Expression/LuaMemberExpression'
import LuaNilLiteral from '@/ast/Expression/LuaNilLiteral'
import LuaNumericLiteral from '@/ast/Expression/LuaNumericLiteral'
import LuaStringCallExpression from '@/ast/Expression/LuaStringCallExpression'
import LuaStringLiteral from '@/ast/Expression/LuaStringLiteral'
import LuaTableCallExpression from '@/ast/Expression/LuaTableCallExpression'
import LuaTableConstructorExpression from '@/ast/Expression/LuaTableConstructorExpression'
import LuaUnaryExpression from '@/ast/Expression/LuaUnaryExpression'
import LuaBase, { ICodeBlock } from '@/ast/LuaBase'
import LuaState from '@/ast/LuaState'
import LuaElseifClause from '@/ast/Node/LuaElseifClause'
import LuaExpression from '@/ast/Node/LuaExpression'
import LuaIfClause from '@/ast/Node/LuaIfClause'
import LuaStatement from '@/ast/Node/LuaStatement'
import LuaTableKey from '@/ast/Node/LuaTableKey'
import LuaTableKeyString from '@/ast/Node/LuaTableKeyString'
import LuaTableValue from '@/ast/Node/LuaTableValue'
import LuaAssignmentStatement from '@/ast/Statement/LuaAssignmentStatement'
import LuaLocalStatement from '@/ast/Statement/LuaLocalStatement'
import LuaRepeatStatement from '@/ast/Statement/LuaRepeatStatement'
import LuaReturnStatement from '@/ast/Statement/LuaReturnStatement'
import LuaWhileStatement from '@/ast/Statement/LuaWhileStatement'
import Step from '../Step'

export default class InlineStep extends Step<{}> {
  private inlineNodes: LuaBase[]

  public constructor(config = {}) {
    super(config)

    this.inlineNodes = []
  }

  protected preVisit(node: LuaBase, state: LuaState): LuaBase | null {
    if (node instanceof LuaAssignmentStatement) this.visitPreAssignmentStatement(node, state)
    else if (node instanceof LuaBinaryExpression) this.visitPreBinaryExpression(node, state)
    else if (node instanceof LuaCallExpression) this.visitPreCallExpression(node, state)
    else if (node instanceof LuaElseifClause) this.visitConditionStatement(node, state)
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

      const isGlobal = state.isGlobal(identifier)
      const refCount = scope.getReferenceCount(identifier)
      const statement = scope.getStatement(identifier)

      // Inline condition: not global & exactly 1 reference & has statement
      if (isGlobal || refCount !== 1 || statement == null) continue

      // Check if statement type is local or assign statement
      if (statement instanceof LuaLocalStatement || statement instanceof LuaAssignmentStatement) {
        const { variables, init } = statement

        // Ignore if statement has more than one variable or missing init
        if (variables.length > 1 || init.length === 0) continue

        this.addInlineNode(init[0], statement, state)
        continue
      }

      // Check if statement type is function declaration
      if (!(statement instanceof LuaFunctionDeclaration)) continue

      this.addInlineNode(statement, statement, state)
    }

    return null
  }

  private addInlineNode(node: LuaBase, statement: LuaStatement, state: LuaState): void {
    const { inlineNodes } = this

    if (inlineNodes.includes(node)) return

    state.log('add inline node:', node, 'statement:', statement)
    inlineNodes.push(node)

    this.iteration = 1
  }

  private isScopeValid(parentNode: LuaBase, childNode: LuaBase, state: LuaState): boolean {
    childNode = parentNode instanceof LuaIdentifier ? (state.getStatement(parentNode) ?? childNode) : childNode

    let parentScope = parentNode.scope
    let childScope = childNode.scope

    if (parentNode instanceof LuaFunctionDeclaration) parentScope = parentScope.parent ?? parentScope
    if (childNode instanceof LuaFunctionDeclaration) childScope = childScope.parent ?? childScope

    state.debug(`is scope valid, parent[${parentScope.getDepth()}]:`, parentNode, `child[${childScope.getDepth()}]:`, childNode)

    return !childScope.isParent(parentScope)
  }

  private consumeInlineNode(node: LuaBase, state: LuaState): boolean {
    const { inlineNodes } = this

    if (!inlineNodes.includes(node)) return false

    state.log('consume inline node:', node)
    inlineNodes.splice(inlineNodes.indexOf(node), 1)

    this.iteration = 1
    return true
  }

  private resolveInitValue(init: LuaExpression, state: LuaState): LuaBase {
    // Check if type is identifier
    if (!(init instanceof LuaIdentifier)) return init

    // Check if init is a global variable or value is unknown
    if (state.isGlobal(init) || state.isUnknown(init)) return init

    // Get the value of the variable
    let value = state.read(init)

    // Check if value is referencing itself
    if (value.hasReference(init)) return init

    // Check if scope is valid
    if (!this.isScopeValid(init, value, state)) return init

    // Try to consume inline node
    const isInlineNode = this.consumeInlineNode(value, state)

    // Check if value type should only be resolved when it is an inline node
    if (
      value instanceof LuaCallExpression ||
      value instanceof LuaStringCallExpression ||
      value instanceof LuaTableCallExpression ||
      value instanceof LuaTableConstructorExpression
    ) {
      // Only resolve if there is only 1 reference
      if (!isInlineNode) return init

      // Remove assign statement
      this.removeNode(state, state.getStatement(init))

      state.log('inline by reference resolve init:', init, '->', value)
    }

    // Clone value
    value = value.clone(init.scope)

    // Check if value type is function declaration
    if (value instanceof LuaFunctionDeclaration) {
      // Remove function declaration identifier
      value.identifier = null

      // Remove original function
      this.removeNode(state, state.getStatement(init))
    }

    state.log('resolve init:', init, '->', value)

    return value
  }

  private visitConditionStatement(node: LuaElseifClause | LuaIfClause | LuaRepeatStatement | LuaWhileStatement, state: LuaState): void {
    const { scope, condition } = node

    // Check if condition is identifier & value is not global or unknown
    if (!(condition instanceof LuaIdentifier) || state.isGlobal(condition) || state.isUnknown(condition)) return

    // Get value of variable
    const value = state.read(condition)

    // Check if value type is valid
    if (value instanceof LuaTableConstructorExpression) return

    // Check if scope is valid
    if (!this.isScopeValid(condition, value, state)) return

    // Try to consume inline node
    if (!this.consumeInlineNode(value, state)) return

    // Clone & replace condition
    node.condition = value.clone(scope)

    // Remove assign statement
    this.removeNode(state, state.getStatement(condition))

    state.log('inline by reference condition expression:', condition, '->', node.condition)
  }

  private visitPreAssignmentStatement(node: LuaAssignmentStatement, state: LuaState): void {
    const { variables, init } = node

    for (let i = 0; i < variables.length; i++) {
      const varName = variables[i]
      const varInit = this.resolveInitValue(init[i], state)

      if (init[i] !== varInit) init[i] = varInit

      if (varName instanceof LuaIdentifier) this.visitPreIdentifierAssignment(varName, varInit, node, state)
    }
  }

  private visitPreBinaryExpression(node: LuaBinaryExpression, state: LuaState): void {
    const { scope, left, right } = node

    // Check if left side type is identifier & value is not global or unknown
    if (left instanceof LuaIdentifier && !state.isGlobal(left) && !state.isUnknown(left)) {
      // Get value of variable
      const value = state.read(left)

      // Check if value is literal or check if scope is valid & try to consume inline node
      if (
        value instanceof LuaNilLiteral ||
        value instanceof LuaStringLiteral ||
        value instanceof LuaNumericLiteral ||
        value instanceof LuaBooleanLiteral ||
        (this.isScopeValid(left, value, state) && this.consumeInlineNode(value, state))
      ) {
        // Clone & replace left expression
        node.left = value.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(left))

        state.log('inline by reference left expression:', left, '->', node.left)
      }
    }

    // Check if right side type is identifier & value is not unknown
    if (right instanceof LuaIdentifier && !state.isGlobal(right) && !state.isUnknown(right)) {
      // Get value of variable
      const value = state.read(right)

      // Check if value is literal or check if scope is valid & try to consume inline node
      if (
        value instanceof LuaNilLiteral ||
        value instanceof LuaStringLiteral ||
        value instanceof LuaNumericLiteral ||
        value instanceof LuaBooleanLiteral ||
        (this.isScopeValid(right, value, state) && this.consumeInlineNode(value, state))
      ) {
        // Clone & replace right expression
        node.right = value.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(right))

        state.log('inline by reference right expression:', right, '->', node.right)
      }
    }
  }

  private visitPreCallExpression(node: LuaCallExpression, state: LuaState): void {
    const { scope, base, arguments: args } = node

    // Check if base is identifier & value is not global or unknown
    if (base instanceof LuaIdentifier && !state.isGlobal(base) && !state.isUnknown(base)) {
      // Get value of variable
      const value = state.read(base)

      // Check if value type is valid & scope is valid & try to consume inline node
      if (
        !(value instanceof LuaFunctionDeclaration) &&
        !(value instanceof LuaTableConstructorExpression) &&
        this.isScopeValid(base, value, state) &&
        this.consumeInlineNode(value, state)
      ) {
        // Clone & replace base
        node.base = value.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(base))

        state.log('inline by reference call base:', base, '->', node.base)
      }
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      // Check if argument type is identifier & value is not global or unknown
      if (!(arg instanceof LuaIdentifier) || state.isGlobal(arg) || state.isUnknown(arg)) continue

      // Get value of variable
      let value = state.read(arg)

      // Check if scope is valid
      if (!this.isScopeValid(arg, value, state)) continue

      // Try to consume inline node
      if (!this.consumeInlineNode(value, state)) continue

      // Clone value
      value = value.clone(scope)

      // Remove function declaration identifier
      if (value instanceof LuaFunctionDeclaration) value.identifier = null

      // Replace argument
      args[i] = value

      // Remove assign statement
      this.removeNode(state, state.getStatement(arg))

      state.log(`inline by reference call arguments[${i}]:`, arg, '->', args[i])
    }
  }

  private visitPreIdentifierAssignment(identifier: LuaIdentifier, init: LuaExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const isGlobal = state.isGlobal(identifier)
    const refCount = state.getReferenceCount(identifier)
    const prevStatement = state.getStatement(identifier)

    // Add previous value as inline node if variable is reassigned with 1 reference
    // Inline condition: not global & exactly 1 reference & statement type is local or assign statement
    if (
      !isGlobal && refCount === 1 && prevStatement != null &&
      (prevStatement instanceof LuaLocalStatement || prevStatement instanceof LuaAssignmentStatement)
    ) {
      const { variables, init } = prevStatement

      // Check if statement has more than one variable or missing init
      if (variables.length === 1 && init.length >= 1) {
        this.addInlineNode(init[0], prevStatement, state)
        return
      }
    }

    if (init instanceof LuaBinaryExpression) {
      this.inlineBinaryExpression(identifier, init, statement, state)
    } else if (init instanceof LuaCallExpression) {
      this.inlineCallBase(identifier, init, statement, state)
      this.inlineCallExpression(identifier, init, statement, state)
    } else if (init instanceof LuaIndexExpression) {
      this.inlineIndexOrMemberBase(identifier, init, statement, state)
      this.inlineIndexExpression(identifier, init, statement, state)
    } else if (init instanceof LuaMemberExpression) {
      this.inlineIndexOrMemberBase(identifier, init, statement, state)
    } else if (init instanceof LuaStringCallExpression) {
      this.inlineCallBase(identifier, init, statement, state)
    } else if (init instanceof LuaTableCallExpression) {
      this.inlineCallBase(identifier, init, statement, state)
    } else if (init instanceof LuaUnaryExpression) {
      this.inlineUnaryExpression(identifier, init, statement, state)
    }
  }

  private visitPreIndexExpression(node: LuaIndexExpression, state: LuaState): void {
    const { scope, base, index } = node

    // Check if base is identifier & value is not global or unknown
    if (base instanceof LuaIdentifier && !state.isGlobal(base) && !state.isUnknown(base)) {
      // Get value of variable
      const value = state.read(base)

      // Check if value type is valid & scope is valid & try to consume inline node
      if (
        !(value instanceof LuaTableConstructorExpression) &&
        this.isScopeValid(base, value, state) &&
        this.consumeInlineNode(value, state)
      ) {
        // Clone & replace base
        node.base = value.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(base))

        state.log('inline by reference index base:', base, '->', node.base)
      }
    }

    // Check if index is identifier & value is not global or unknown
    if (index instanceof LuaIdentifier && !state.isGlobal(index) && !state.isUnknown(index)) {
      // Get value of variable
      const value = state.read(index)

      // Check if scope is valid & try to consume inline node
      if (this.isScopeValid(index, value, state) && this.consumeInlineNode(value, state)) {
        // Clone & replace index
        node.index = value.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(index))

        state.log('inline by reference index expression:', index, '->', node.index)
      }
    }
  }

  private visitPreBaseExpression(node: LuaMemberExpression | LuaStringCallExpression | LuaTableCallExpression, state: LuaState): void {
    const { scope, base } = node

    // Check if base is identifier & value is not global or unknown
    if (!(base instanceof LuaIdentifier) || state.isGlobal(base) || state.isUnknown(base)) return

    // Get value of variable
    const value = state.read(base)

    // Check if value type is valid
    if (value instanceof LuaTableConstructorExpression) return

    // Check if scope is valid
    if (!this.isScopeValid(base, value, state)) return

    // Try to consume inline node
    if (!this.consumeInlineNode(value, state)) return

    // Clone & replace base
    node.base = value.clone(scope)

    // Remove assign statement
    this.removeNode(state, state.getStatement(base))

    state.log('inline by reference base expression:', base, '->', node.base)
  }

  private visitPreReturnStatement(node: LuaReturnStatement, state: LuaState): void {
    const { scope, arguments: args } = node

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      // Check if argument type is identifier & value is not global or unknown
      if (!(arg instanceof LuaIdentifier) || state.isGlobal(arg) || state.isUnknown(arg)) continue

      // Get value of variable
      let value = state.read(arg)

      // Check if scope is valid
      if (!this.isScopeValid(arg, value, state)) continue

      // Try to consume inline node
      if (!this.consumeInlineNode(value, state)) continue

      // Clone value
      value = value.clone(scope)

      // Remove function declaration identifier
      if (value instanceof LuaFunctionDeclaration) value.identifier = null

      // Replace argument
      args[i] = value

      // Remove assign statement
      this.removeNode(state, state.getStatement(arg))

      state.log(`inline by reference return arguments[${i}]:`, arg, '->', args[i])
    }
  }

  private visitPreTableKey(node: LuaTableKey, state: LuaState): void {
    const { scope, key, value } = node

    // Check if key type is identifier & value is not global or unknown
    if (key instanceof LuaIdentifier && !state.isGlobal(key) && !state.isUnknown(key)) {
      // Get value of variable
      const value = state.read(key)

      // Check if value is literal or check if scope is valid & try to consume inline node
      if (
        value instanceof LuaNilLiteral ||
        value instanceof LuaStringLiteral ||
        value instanceof LuaNumericLiteral ||
        value instanceof LuaBooleanLiteral ||
        (this.isScopeValid(key, value, state) && this.consumeInlineNode(value, state))
      ) {
        // Clone & replace key expression
        node.key = value.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(key))

        state.log('inline by reference key expression:', key, '->', node.key)
      }
    }

    // Check if value type is identifier & value is not global or unknown
    if (value instanceof LuaIdentifier && !state.isGlobal(value) && !state.isUnknown(value)) {
      // Get value of variable
      const varValue = state.read(value)

      // Check if value is literal or check if scope is valid & try to consume inline node
      if (
        varValue instanceof LuaNilLiteral ||
        varValue instanceof LuaStringLiteral ||
        varValue instanceof LuaNumericLiteral ||
        varValue instanceof LuaBooleanLiteral ||
        (this.isScopeValid(value, varValue, state) && this.consumeInlineNode(varValue, state))
      ) {
        // Clone & replace value expression
        node.value = varValue.clone(scope)

        // Remove assign statement
        this.removeNode(state, state.getStatement(value))

        state.log('inline by reference value expression:', value, '->', node.value)
      }
    }
  }

  private visitPreTableValue(node: LuaTableKeyString | LuaTableValue, state: LuaState): void {
    const { scope, value } = node

    // Check if value type is identifier
    if (!(value instanceof LuaIdentifier)) return

    // Check if value is not global or unknown
    if (state.isGlobal(value) || state.isUnknown(value)) return

    // Get value of variable
    const varValue = state.read(value)

    // Check if scope is valid
    if (!this.isScopeValid(value, varValue, state)) return

    // Try to consume inline node
    if (!this.consumeInlineNode(varValue, state)) return

    // Clone & replace value expression
    node.value = varValue.clone(scope)

    // Remove assign statement
    this.removeNode(state, state.getStatement(value))

    state.log('inline by reference value expression:', value, '->', node.value)
  }

  private visitPreUnaryExpression(node: LuaUnaryExpression, state: LuaState): void {
    const { scope, argument } = node

    // Check if argument type is identifier & value is not global or unknown
    if (!(argument instanceof LuaIdentifier) || state.isGlobal(argument) || state.isUnknown(argument)) return

    // Get value of variable
    const value = state.read(argument)

    // Check if scope is valid
    if (!this.isScopeValid(argument, value, state)) return

    // Try to consume inline node
    if (!this.consumeInlineNode(value, state)) return

    // Clone & replace argument expression
    node.argument = value.clone(scope)

    // Remove assign statement
    this.removeNode(state, state.getStatement(argument))

    state.log('inline by reference argument expression:', argument, '->', node.argument)
  }

  private inlineBinaryExpression(identifier: LuaIdentifier, node: LuaBinaryExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const { scope, left, right } = node

    // Check if left side type is identifier
    if (left instanceof LuaIdentifier) {
      // Check if value is reference to the same variable & this is the first reference to it
      if (left.isMatch(identifier) && state.getReferenceCount(identifier) === 0) {
        const value = state.read(left)

        // Consume inline node
        this.consumeInlineNode(value, state)

        // Get statement before appling changes
        const before = statement.toString(0, true)

        // Clone the value of the variable to left expression
        node.left = value.clone(scope)

        state.log('inline by identifier left expression:', before, '->', statement)

        // Remove assign statement
        this.removeNode(state, state.getStatement(left))
      }
    }

    // Check if right side type is identifier
    if (right instanceof LuaIdentifier) {
      // Check if value is reference to the same variable & this is the first reference to it
      if (right.isMatch(identifier) && state.getReferenceCount(identifier) === 0) {
        const value = state.read(right)

        // Consume inline node
        this.consumeInlineNode(value, state)

        // Get statement before appling changes
        const before = statement.toString(0, true)

        // Clone the value of the variable to right expression
        node.right = value.clone(scope)

        state.log('inline by identifier right expression:', before, '->', statement)

        // Remove assign statement
        this.removeNode(state, state.getStatement(right))
      }
    }
  }

  private inlineCallBase(identifier: LuaIdentifier, node: LuaCallExpression | LuaStringCallExpression | LuaTableCallExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const { scope, base } = node

    // Check if base type is index expression
    if (base instanceof LuaIndexExpression) {
      this.inlineIndexOrMemberBase(identifier, base, statement, state)
      this.inlineIndexExpression(identifier, base, statement, state)
      return
    }

    // Check if base type is member expression
    if (base instanceof LuaMemberExpression) {
      this.inlineIndexOrMemberBase(identifier, base, statement, state)
      return
    }

    // Check if base type is identifier
    if (!(base instanceof LuaIdentifier)) return

    // Check if base is reference to the same variable & there is no other reference before it
    if (
      !base.isMatch(identifier) ||
      state.getReferenceCount(identifier) > 0
    ) return

    // Get the value of the variable
    const value = state.read(base)

    // Check if value type is valid
    if (
      value instanceof LuaFunctionDeclaration ||
      value instanceof LuaTableConstructorExpression
    ) return

    // Consume inline node
    this.consumeInlineNode(value, state)

    // Get statement before appling changes
    const before = statement.toString(0, true)

    // Clone the value of the variable to base expression
    node.base = value.clone(scope)

    state.log('inline by identifier call base:', before, '->', statement)

    // Remove assign statement
    this.removeNode(state, state.getStatement(base))
  }

  private inlineCallExpression(identifier: LuaIdentifier, node: LuaCallExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const { scope, arguments: args } = node

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      // Check if argument type is identifier
      if (!(arg instanceof LuaIdentifier)) continue

      // Check if argument is reference to the same variable & there is no other reference before it
      if (
        !arg.isMatch(identifier) ||
        state.getReferenceCount(identifier) > 0
      ) continue

      // Get the value of the variable
      const value = state.read(arg)

      // Check if value type is valid
      if (
        value instanceof LuaFunctionDeclaration ||
        value instanceof LuaTableConstructorExpression
      ) return

      // Consume inline node
      this.consumeInlineNode(value, state)

      // Get statement before appling changes
      const before = statement.toString(0, true)

      // Clone the value of the variable to base expression
      args[i] = value.clone(scope)

      state.log(`inline by identifier call argument[${i}]:`, before, '->', statement)

      // Remove assign statement
      this.removeNode(state, state.getStatement(arg))
    }
  }

  private inlineIndexExpression(identifier: LuaIdentifier, node: LuaIndexExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const { scope, base, index } = node

    // Check if index type is valid
    if (!(index instanceof LuaIdentifier)) return

    // Check if index is reference to the same variable & this is the first reference to it
    if (
      !index.isMatch(identifier) ||
      state.getReferenceCount(identifier) > 0
    ) return

    // Get the value of the variable
    const value = state.read(index)

    // Check if value type is valid
    if (
      value instanceof LuaFunctionDeclaration ||
      value instanceof LuaTableConstructorExpression
    ) return

    // FIXME: Probably not the correct way to fix the issue?
    // Check if value has reference to base
    if (base instanceof LuaIdentifier && value.hasReference(base)) return

    // Consume inline node
    this.consumeInlineNode(value, state)

    // Get statement before appling changes
    const before = statement.toString(0, true)

    // Clone the value of the variable to index expression
    node.index = value.clone(scope)

    state.log('inline by identifier index expression:', before, '->', statement)

    // Remove assign statement
    this.removeNode(state, state.getStatement(index))
  }

  private inlineIndexOrMemberBase(identifier: LuaIdentifier, node: LuaIndexExpression | LuaMemberExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const { scope, base } = node

    // Check if base type is identifier
    if (!(base instanceof LuaIdentifier)) return

    // Check if base is reference to the same variable & there is no other reference before it
    if (
      !base.isMatch(identifier) ||
      state.getReferenceCount(identifier) > 0
    ) return

    // Get the value of the variable
    const value = state.read(base)

    // Check if value type is valid
    if (
      value instanceof LuaFunctionDeclaration ||
      value instanceof LuaTableConstructorExpression
    ) return

    // Consume inline node
    this.consumeInlineNode(value, state)

    // Get statement before appling changes
    const before = statement.toString(0, true)

    // Clone the value of the variable to base expression
    node.base = value.clone(scope)

    state.log('inline by identifier index or member base:', before, '->', statement)

    // Remove assign statement
    this.removeNode(state, state.getStatement(base))
  }

  private inlineUnaryExpression(identifier: LuaIdentifier, node: LuaUnaryExpression, statement: LuaAssignmentStatement, state: LuaState): void {
    const { scope, argument } = node

    // Check if argument type is identifier
    if (!(argument instanceof LuaIdentifier)) return

    // Check if value is reference to the same variable & this is the first reference to it
    if (!argument.isMatch(identifier) || state.getReferenceCount(identifier) > 0) return

    // Get value of variable
    const value = state.read(argument)

    // Consume inline node
    this.consumeInlineNode(value, state)

    // Get statement before appling changes
    const before = statement.toString(0, true)

    // Clone the value of the variable to argument expression
    node.argument = value.clone(scope)

    state.log('inline by identifier argument expression:', before, '->', statement)

    // Remove assign statement
    this.removeNode(state, state.getStatement(argument))
  }
}