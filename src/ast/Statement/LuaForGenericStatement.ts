import { ForGenericStatement } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaStatement from '../Node/LuaStatement'

export default class LuaForGenericStatement extends LuaStatement<'ForGenericStatement'> implements ICodeBlock {
  public variables: LuaIdentifier[]
  public iterators: LuaExpression[]
  public body: LuaStatement[]

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.variables = []
    this.iterators = []
    this.body = []
  }

  public getStatementByType<TType extends keyof typeof ASTMap, TAst extends typeof LuaStatement<TType>>(type: TAst): InstanceType<TAst>[] {
    const { body } = this

    return <InstanceType<TAst>[]>body.filter(s => s instanceof type)
  }

  public getReferences(): LuaIdentifier[] {
    const { iterators } = this
    const references: LuaIdentifier[] = []

    for (const iterator of iterators) references.push(...iterator.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.variables.splice(0)
    this.iterators.splice(0)
    this.body.splice(0)

    return this
  }

  public fromJson(obj: ForGenericStatement): this {
    super.fromJson(obj)

    const { variables, iterators, body } = obj

    this.variables.push(...variables.map(i => LuaBase.createFromJson(i, this.scope)))
    this.iterators.push(...iterators.map(e => LuaBase.createFromJson(e, this.scope.parent!)))
    this.body.push(...body.map(s => LuaBase.createFromJson(s, this.scope)))

    return this
  }

  public toJson(): ForGenericStatement {
    const { variables, iterators, body } = this

    return Object.assign(super.toJson(), <ForGenericStatement>{
      variables: variables.map(i => i.toJson()),
      iterators: iterators.map(e => e.toJson()),
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, variables, iterators, body } = this

    const padding = isInline ? '' : ' '.repeat(indent * (scope.getDepth() - 1))

    let output = `${padding}for ${variables.map(i => i.toString()).join(', ')} in ${iterators.map(e => e.toString(indent)).join(', ')} do\n`
    output += body.map(s => s.toString(indent)).join('\n')
    output += `\n${padding}end`

    return output
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { scope, variables, iterators, body } = this

    for (let i = 0; i < variables.length; i++) {
      variables[i] = <typeof variables[0]>variables[i].visit(pre, post, postBlock, state)
    }

    for (let i = 0; i < iterators.length; i++) {
      iterators[i] = iterators[i].visit(pre, post, postBlock, state)
    }

    state.push(scope)
    for (let i = 0; i < body.length; i++) {
      body[i] = body[i].visit(pre, post, postBlock, state)
    }

    if (typeof postBlock === 'function') {
      const newBody = postBlock(this, state)

      if (newBody != null) {
        body.splice(0)
        body.push(...newBody)
      }
    }
    state.pop()
  }
}