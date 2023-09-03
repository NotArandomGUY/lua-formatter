import List from '@/lib/list'
import { ForNumericStatement } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaStatement from '../Node/LuaStatement'

export default class LuaForNumericStatement extends LuaStatement<'ForNumericStatement'> implements ICodeBlock {
  public variable: LuaIdentifier | null
  public start: LuaExpression | null
  public end: LuaExpression | null
  public step: LuaExpression | null
  public body: List<LuaStatement>

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.variable = null
    this.start = null
    this.end = null
    this.step = null
    this.body = new List()
  }

  public getStatementByType<TType extends keyof typeof ASTMap, TAst extends typeof LuaStatement<TType>>(type: TAst): InstanceType<TAst>[] {
    const { body } = this

    return <InstanceType<TAst>[]>body.filter(s => s instanceof type)
  }

  public getReferences(): LuaIdentifier[] {
    const { variable, start, end, step } = this
    const references: LuaIdentifier[] = []

    if (variable != null) references.push(...variable.getReferences())
    if (start != null) references.push(...start.getReferences())
    if (end != null) references.push(...end.getReferences())
    if (step != null) references.push(...step.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.variable = null
    this.start = null
    this.end = null
    this.step = null
    this.body.clear()

    return this
  }

  public fromJson(obj: ForNumericStatement): this {
    super.fromJson(obj)

    const { scope, body: loopBody } = this
    const { variable, start, end, step, body } = obj

    this.variable = LuaBase.createFromJson(variable, scope)
    this.start = LuaBase.createFromJson(start, scope)
    this.end = LuaBase.createFromJson(end, scope)
    this.step = step == null ? null : LuaBase.createFromJson(step, scope)

    for (const statement of body) {
      loopBody.push(LuaBase.createFromJson(statement, scope))
    }

    return this
  }

  public toJson(): ForNumericStatement {
    const { variable, start, end, step, body } = this

    if (variable == null) throw new Error('Invalid variable identifier')
    if (start == null) throw new Error('Invalid start expression')
    if (end == null) throw new Error('Invalid end expression')

    return Object.assign(super.toJson(), <ForNumericStatement>{
      variable: variable.toJson(),
      start: start.toJson(),
      end: end.toJson(),
      step: step?.toJson() ?? null,
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, variable, start, end, step, body } = this

    if (variable == null) throw new Error('Invalid variable identifier')
    if (start == null) throw new Error('Invalid start expression')
    if (end == null) throw new Error('Invalid end expression')

    const padding = isInline ? '' : ' '.repeat(indent * (scope.getDepth() - 1))

    let output = `${padding}for ${variable.toString()} = ${start.toString(indent)}, ${end.toString(indent)}`

    if (step != null) output += `, ${step.toString(indent)}`

    output += ' do\n'
    output += body.map(s => s.toString(indent)).join('\n')
    output += `\n${padding}end`

    return output
  }

  public removeChild(statement: LuaStatement): boolean {
    const { body } = this

    return body.remove(body.indexOf(statement)) != null
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { scope, variable, start, end, step, body } = this

    this.variable = <typeof variable>(await variable?.visit(pre, post, postBlock, state) ?? null)
    this.start = await start?.visit(pre, post, postBlock, state) ?? null
    this.end = await end?.visit(pre, post, postBlock, state) ?? null
    this.step = await step?.visit(pre, post, postBlock, state) ?? null

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