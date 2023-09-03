import LuaBinaryExpression from '@/ast/Expression/LuaBinaryExpression'
import LuaCallExpression from '@/ast/Expression/LuaCallExpression'
import LuaFunctionDeclaration from '@/ast/Expression/LuaFunctionDeclaration'
import LuaIdentifier from '@/ast/Expression/LuaIdentifier'
import LuaIndexExpression from '@/ast/Expression/LuaIndexExpression'
import LuaLogicalExpression from '@/ast/Expression/LuaLogicalExpression'
import LuaMemberExpression from '@/ast/Expression/LuaMemberExpression'
import LuaUnaryExpression from '@/ast/Expression/LuaUnaryExpression'
import LuaBase, { ICodeBlock } from '@/ast/LuaBase'
import LuaScope from '@/ast/LuaScope'
import LuaState from '@/ast/LuaState'
import LuaChunk from '@/ast/Node/LuaChunk'
import LuaElseClause from '@/ast/Node/LuaElseClause'
import LuaElseifClause from '@/ast/Node/LuaElseifClause'
import LuaIfClause from '@/ast/Node/LuaIfClause'
import LuaTableKey from '@/ast/Node/LuaTableKey'
import LuaTableKeyString from '@/ast/Node/LuaTableKeyString'
import LuaTableValue from '@/ast/Node/LuaTableValue'
import LuaAssignmentStatement from '@/ast/Statement/LuaAssignmentStatement'
import LuaDoStatement from '@/ast/Statement/LuaDoStatement'
import LuaForGenericStatement from '@/ast/Statement/LuaForGenericStatement'
import LuaForNumericStatement from '@/ast/Statement/LuaForNumericStatement'
import LuaIfStatement from '@/ast/Statement/LuaIfStatement'
import LuaLocalStatement from '@/ast/Statement/LuaLocalStatement'
import LuaRepeatStatement from '@/ast/Statement/LuaRepeatStatement'
import LuaReturnStatement from '@/ast/Statement/LuaReturnStatement'
import LuaWhileStatement from '@/ast/Statement/LuaWhileStatement'

export default abstract class Step<TConf> {
  public static create<TConf, TStep extends Step<TConf>>(ctor: new (config?: TConf) => TStep, config?: TConf): TStep {
    return new ctor(config)
  }

  protected config: TConf
  protected iteration: number
  protected currentIteration: number
  protected isChanged: boolean

  private pendingRemoveNodes: LuaBase[]

  public constructor(config?: TConf) {
    if (config == null) throw new Error('Config cannot be null')

    this.config = config
    this.iteration = 1
    this.currentIteration = 0
    this.isChanged = false

    this.pendingRemoveNodes = []
  }

  public async apply(ast: LuaChunk, maxIteration = 100): Promise<boolean> {
    const padding = '='.repeat(20)

    console.log(`${padding}[BEGIN ${this.constructor.name}]${padding}`)

    this.isChanged = false

    while (this.iteration-- > 0) {
      // Hard crash when getting stuck
      if (this.currentIteration++ >= maxIteration) {
        console.log(`${padding}[CDUMP ${this.constructor.name}]${padding}`)
        console.log(ast.toString())
        break
      }

      console.log(`${padding}[IT${this.currentIteration.toString().padStart(3, '0')} ${this.constructor.name}]${padding}`)

      ast.scope.clear()
      await ast.visit(
        this.preVisitInternal.bind(this),
        this.postVisitInternal.bind(this),
        this.postVisitBlockInternal.bind(this)
      )
    }

    console.log(`${padding}[ENDED ${this.constructor.name}]${padding}`)

    return this.isChanged
  }

  protected abstract preVisit(node: LuaBase, state: LuaState): LuaBase | null

  protected abstract postVisit(node: LuaBase, state: LuaState): LuaBase | null

  protected abstract postVisitBlock(node: LuaBase & ICodeBlock, state: LuaState): LuaBase[] | null

  protected removeNode(state: LuaState, ...nodes: Array<LuaBase | undefined | null>): void {
    const { pendingRemoveNodes } = this

    for (const node of nodes) {
      if (node == null || pendingRemoveNodes.includes(node)) continue

      let scope: LuaScope | null = node.scope
      let isRemoved = false

      while (scope != null) {
        const scopeNode = scope.node

        if (
          (
            scopeNode instanceof LuaFunctionDeclaration ||
            scopeNode instanceof LuaChunk ||
            scopeNode instanceof LuaElseClause ||
            scopeNode instanceof LuaElseifClause ||
            scopeNode instanceof LuaIfClause ||
            scopeNode instanceof LuaDoStatement ||
            scopeNode instanceof LuaForGenericStatement ||
            scopeNode instanceof LuaForNumericStatement ||
            scopeNode instanceof LuaRepeatStatement ||
            scopeNode instanceof LuaWhileStatement
          ) &&
          scopeNode.removeChild(node)
        ) {
          this.isChanged = true
          isRemoved = true

          state.log('removed node:', node)
          break
        }

        scope = scope.parent
      }

      if (isRemoved) continue

      state.log('pending remove node:', node)

      pendingRemoveNodes.push(node)
    }
  }

  private preVisitInternal(node: LuaBase, state: LuaState): LuaBase | null {
    state.debug('pre visit, type:', node.type, 'data:', node)

    if (node instanceof LuaElseifClause) this.internalVisitConditionStatement(node, state)
    else if (node instanceof LuaForGenericStatement) this.internalVisitPreForGenericStatement(node, state)
    else if (node instanceof LuaForNumericStatement) this.internalVisitPreForNumericStatement(node, state)
    else if (node instanceof LuaFunctionDeclaration) this.internalVisitPreFunctionDeclaration(node, state)
    else if (node instanceof LuaIfClause) this.internalVisitConditionStatement(node, state)
    else if (node instanceof LuaIfStatement) this.internalVisitPreIfStatement(node, state)
    else if (node instanceof LuaWhileStatement) this.internalVisitConditionStatement(node, state)

    return this.preVisit(node, state)
  }

  private postVisitInternal(node: LuaBase, state: LuaState): LuaBase | null { // NOSONAR
    state.debug('post visit, type:', node.type, 'data:', node)

    if (node instanceof LuaAssignmentStatement) this.internalVisitPostAssignmentStatement(node, state)
    else if (node instanceof LuaBinaryExpression) this.internalVisitPostLeftRightExpression(node, state)
    else if (node instanceof LuaCallExpression) this.internalVisitPostCallExpression(node, state)
    else if (node instanceof LuaFunctionDeclaration) this.internalVisitPostFunctionDeclaration(node, state)
    else if (node instanceof LuaIndexExpression) this.internalVisitPostIndexExpression(node, state)
    else if (node instanceof LuaLocalStatement) this.internalVisitPostLocalStatement(node, state)
    else if (node instanceof LuaLogicalExpression) this.internalVisitPostLeftRightExpression(node, state)
    else if (node instanceof LuaMemberExpression) this.internalVisitPostMemberExpression(node, state)
    else if (node instanceof LuaRepeatStatement) this.internalVisitConditionStatement(node, state)
    else if (node instanceof LuaReturnStatement) this.internalVisitPostReturnStatement(node, state)
    else if (node instanceof LuaTableKey) this.internalVisitPostTableKey(node, state)
    else if (node instanceof LuaTableKeyString) this.internalVisitPostTableValue(node, state)
    else if (node instanceof LuaTableValue) this.internalVisitPostTableValue(node, state)
    else if (node instanceof LuaUnaryExpression) this.internalVisitPostUnaryExpression(node, state)

    return this.postVisit(node, state)
  }

  private postVisitBlockInternal(node: LuaBase & ICodeBlock, state: LuaState): LuaBase[] | null {
    state.debug('post visit block, type:', node.type, 'data:', node)

    const { pendingRemoveNodes } = this

    let body = this.postVisitBlock(node, state)

    if (pendingRemoveNodes.length === 0) return body
    if (body == null) body = node.body.toArray()

    const removedNodes = body.filter(n => pendingRemoveNodes.includes(n))

    if (removedNodes.length === 0) return body

    this.pendingRemoveNodes = pendingRemoveNodes.filter(n => !removedNodes.includes(n))
    this.isChanged = true

    state.log(`removed ${removedNodes.length} pending nodes`)

    let remain = pendingRemoveNodes.length

    for (const node of removedNodes) {
      state.debug('removed node:', node, 'remain:', --remain)
    }

    return body.filter(n => !removedNodes.includes(n))
  }

  private internalVisitConditionStatement(node: LuaElseifClause | LuaIfClause | LuaRepeatStatement | LuaWhileStatement, state: LuaState): void {
    const { condition } = node

    // Bump condition identifier reference count
    if (condition instanceof LuaIdentifier) state.read(condition, node)
  }

  private internalVisitPreForGenericStatement(node: LuaForGenericStatement, state: LuaState): void {
    const { scope, variables, iterators } = node

    for (const variable of variables) {
      if (!scope.alloc(variable, true, node)) {
        state.debug('redefined for generic variable:', variable)
        continue
      }

      state.debug('declare for generic variable:', variable)
    }

    for (const iterator of iterators) {
      // Bump iterator identifier reference count
      if (iterator instanceof LuaIdentifier) state.read(iterator, node)
    }
  }

  private internalVisitPreForNumericStatement(node: LuaForNumericStatement, state: LuaState): void {
    const { scope, variable, start, step, end } = node

    if (variable != null) {
      if (scope.alloc(variable, true, node)) {
        state.debug('declare for numeric variable:', variable)
      } else {
        state.debug('redefined for numeric variable:', variable)
      }
    }

    // Bump start identifier reference count
    if (start instanceof LuaIdentifier) state.read(start, node)

    // Bump step identifier reference count
    if (step instanceof LuaIdentifier) state.read(step, node)

    // Bump end identifier reference count
    if (end instanceof LuaIdentifier) state.read(end, node)
  }

  private internalVisitPreFunctionDeclaration(node: LuaFunctionDeclaration, state: LuaState): void {
    const { scope, parameters } = node

    for (const param of parameters) {
      if (!(param instanceof LuaIdentifier)) continue

      if (!scope.alloc(param, true, node)) {
        state.debug('redefined parameter:', param)
        continue
      }

      state.debug('declare function parameter:', param)
    }
  }

  private internalVisitPreIfStatement(node: LuaIfStatement, state: LuaState): void {
    const { pendingRemoveNodes } = this
    const { clauses } = node

    for (let i = 0; i < clauses.length; i++) {
      while (true) {
        const clause = clauses[i]

        if (!pendingRemoveNodes.includes(clause)) break

        clauses.splice(i, 1)
      }
    }

    if (clauses.length > 0) return

    state.log('removed all clauses from statement:', node)

    this.removeNode(state, node)
  }

  private internalVisitPostAssignmentStatement(node: LuaAssignmentStatement, state: LuaState): void {
    const { variables, init } = node

    for (let i = 0; i < variables.length; i++) {
      const varName = variables[i]
      const varInit = init[i]

      // Bump init identifier reference count
      if (varInit instanceof LuaIdentifier) state.read(varInit, node)

      // Write value of identifier & reset reference count
      if (varName instanceof LuaIdentifier) {
        if (!state.write(varName, varInit, node)) {
          state.log('write failed:', varName)
          continue
        }

        state.debug('assign value to variable:', varInit, '->', varName)
      }
    }
  }

  private internalVisitPostCallExpression(node: LuaCallExpression, state: LuaState) {
    const { base, arguments: args } = node

    // Bump base identifier reference count
    if (base instanceof LuaIdentifier) state.read(base, node)

    for (const arg of args) {
      // Bump argument identifier reference count
      if (arg instanceof LuaIdentifier) state.read(arg, node)
    }
  }

  private internalVisitPostFunctionDeclaration(node: LuaFunctionDeclaration, state: LuaState): void {
    const { identifier, isLocal } = node

    if (!(identifier instanceof LuaIdentifier)) return

    if (isLocal && !state.alloc(identifier, false, node)) state.debug('redefined local:', identifier)

    if (!state.write(identifier, node, node)) {
      state.log('write failed:', identifier)
      return
    }

    state.debug(`declare ${isLocal || !state.isGlobal(identifier) ? 'local ' : ''}function: `, identifier)
  }

  private internalVisitPostIndexExpression(node: LuaIndexExpression, state: LuaState): void {
    const { base, index } = node

    // Bump base identifier reference count
    if (base instanceof LuaIdentifier) state.read(base, node)

    // Bump index identifier reference count
    if (index instanceof LuaIdentifier) state.read(index, node)
  }

  private internalVisitPostLeftRightExpression(node: LuaBinaryExpression | LuaLogicalExpression, state: LuaState) {
    const { left, right } = node

    // Bump left side identifier reference count
    if (left instanceof LuaIdentifier) state.read(left, node)

    // Bump right side identifier reference count
    if (right instanceof LuaIdentifier) state.read(right, node)
  }

  private internalVisitPostLocalStatement(node: LuaLocalStatement, state: LuaState): void {
    const { variables, init } = node

    for (let i = 0; i < variables.length; i++) {
      const varName = variables[i]
      const varInit = init[i]

      // Declare variable
      if (!state.alloc(varName, false, node)) state.debug('redefined local:', varName)

      if (varInit == null) {
        state.debug('declare local:', varName)

        // Check if variable is unknown
        if (init.length > 0) state.write(varName, null, node)
        continue
      }

      // Write value of variable
      if (!state.write(varName, varInit, node)) {
        state.log('write failed:', varName)
        continue
      }

      state.debug('declare local with init:', varInit, '->', varName)
    }
  }

  private internalVisitPostMemberExpression(node: LuaMemberExpression, state: LuaState): void {
    const { base } = node

    // Bump base identifier reference count
    if (base instanceof LuaIdentifier) state.read(base, node)
  }

  private internalVisitPostReturnStatement(node: LuaReturnStatement, state: LuaState): void {
    const { arguments: args } = node

    for (const arg of args) {
      // Bump argument identifier reference count
      if (arg instanceof LuaIdentifier) state.read(arg, node)
    }
  }

  private internalVisitPostTableKey(node: LuaTableKey, state: LuaState): void {
    const { key, value } = node

    // Bump key identifier reference count
    if (key instanceof LuaIdentifier) state.read(key, node)

    // Bump value identifier reference count
    if (value instanceof LuaIdentifier) state.read(value, node)
  }

  private internalVisitPostTableValue(node: LuaTableKeyString | LuaTableValue, state: LuaState): void {
    const { value } = node

    // Bump value identifier reference count
    if (value instanceof LuaIdentifier) state.read(value, node)
  }

  private internalVisitPostUnaryExpression(node: LuaUnaryExpression, state: LuaState): void {
    const { argument } = node

    // Bump argument identifier reference count
    if (argument instanceof LuaIdentifier) state.read(argument, node)
  }
}