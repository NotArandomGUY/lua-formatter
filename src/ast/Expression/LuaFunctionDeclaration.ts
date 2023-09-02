import List from '@/lib/list'
import { FunctionDeclaration } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from '../Node/LuaStatement'
import LuaIdentifier from './LuaIdentifier'
import LuaMemberExpression from './LuaMemberExpression'
import LuaVarargLiteral from './LuaVarargLiteral'

export default class LuaFunctionDeclaration extends LuaStatement<'FunctionDeclaration'> implements ICodeBlock {
  public identifier: LuaIdentifier | LuaMemberExpression | null
  public isLocal: boolean
  public parameters: (LuaIdentifier | LuaVarargLiteral)[]
  public body: List<LuaStatement>

  public constructor(parentScope: LuaScope, body: LuaStatement[] = []) {
    super()

    this.scope.parent = parentScope

    this.identifier = null
    this.isLocal = false
    this.parameters = []
    this.body = new List()
  }

  public getStatementByType<TType extends keyof typeof ASTMap, TAst extends typeof LuaStatement<TType>>(type: TAst): InstanceType<TAst>[] {
    const { body } = this

    return <InstanceType<TAst>[]>body.filter(s => s instanceof type)
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    super.clear()

    this.identifier = null
    this.isLocal = false
    this.parameters.splice(0)
    this.body.clear()

    return this
  }

  public fromJson(obj: FunctionDeclaration): this {
    super.fromJson(obj)

    const { scope, body: funcBody } = this
    const { identifier, isLocal, parameters, body } = obj

    this.identifier = identifier == null ? null : LuaBase.createFromJson(identifier, scope)
    this.isLocal = isLocal
    this.parameters.push(...parameters.map(p => LuaBase.createFromJson(p, scope)))

    for (const statement of body) {
      funcBody.push(LuaBase.createFromJson(statement, scope))
    }

    return this
  }

  public toJson(): FunctionDeclaration {
    const { identifier, isLocal, parameters, body } = this

    return Object.assign(super.toJson(), <FunctionDeclaration>{
      identifier: identifier?.toJson() ?? null,
      isLocal,
      parameters: parameters.map(p => p.toJson()),
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, identifier, isLocal, parameters, body } = this

    const padding = ' '.repeat(indent * (scope.getDepth() - 1))

    let output = isInline ? '' : padding

    if (isLocal && identifier != null) output += 'local '
    output += 'function'
    if (identifier != null) output += ` ${identifier.toString()}`
    output += `(${parameters.map(p => p.toString()).join(', ')})\n`
    output += body.map(s => s.toString(indent)).join('\n')
    output += `\n${padding}end`

    return output
  }

  public removeChild(statement: LuaStatement): boolean {
    const { body } = this

    return body.remove(body.indexOf(statement)) != null
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { scope, identifier, parameters, body } = this

    this.identifier = <typeof identifier>(await identifier?.visit(pre, post, postBlock, state) ?? null)

    for (let i = 0; i < parameters.length; i++) {
      parameters[i] = <typeof parameters[0]>(await parameters[i].visit(pre, post, postBlock, state))
    }

    state.push(scope)

    let curNode = body.head

    while (curNode != null) {
      curNode.value = await curNode.value.visit(pre, post, postBlock, state)
      curNode = curNode.getNext()
    }

    if (typeof postBlock === 'function') {
      const newBody = postBlock(this, state)

      if (newBody != null) {
        body.clear()

        for (const statement of newBody) {
          body.push(statement)
        }
      }
    }
    state.pop()
  }
}