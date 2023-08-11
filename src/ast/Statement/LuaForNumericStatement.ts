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
  public body: LuaStatement[]

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.variable = null
    this.start = null
    this.end = null
    this.step = null
    this.body = []
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
    this.body.splice(0)

    return this
  }

  public fromJson(obj: ForNumericStatement): this {
    super.fromJson(obj)

    const { variable, start, end, step, body } = obj

    this.variable = LuaBase.createFromJson(variable, this.scope)
    this.start = LuaBase.createFromJson(start, this.scope)
    this.end = LuaBase.createFromJson(end, this.scope)
    this.step = step == null ? null : LuaBase.createFromJson(step, this.scope)
    this.body.push(...body.map(s => LuaBase.createFromJson(s, this.scope)))

    return this
  }

  public toJson(): ForNumericStatement {
    const { variable, start, end, step, body } = this

    if (variable == null) throw new Error('Invalid variable identifier')
    if (start == null) throw new Error('Invalid start expression')
    if (end == null) throw new Error('Invalid end expression')
    if (step == null) throw new Error('Invalid step expression')

    return Object.assign(super.toJson(), <ForNumericStatement>{
      variable: variable.toJson(),
      start: start.toJson(),
      end: end.toJson(),
      step: step.toJson(),
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, variable, start, end, step, body } = this

    if (variable == null) throw new Error('Invalid variable identifier')
    if (start == null) throw new Error('Invalid start expression')
    if (end == null) throw new Error('Invalid end expression')
    if (step == null) throw new Error('Invalid step expression')

    const padding = isInline ? '' : ' '.repeat(indent * (scope.getDepth() - 1))

    let output = `${padding}for ${variable.toString()} = ${start.toString(indent)}, ${end.toString(indent)}, ${step.toString(indent)} do\n`
    output += body.map(s => s.toString(indent)).join('\n')
    output += `\n${padding}end`

    return output
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { scope, variable, start, end, step, body } = this

    this.variable = <typeof variable>variable?.visit(pre, post, postBlock, state) ?? null
    this.start = start?.visit(pre, post, postBlock, state) ?? null
    this.end = end?.visit(pre, post, postBlock, state) ?? null
    this.step = step?.visit(pre, post, postBlock, state) ?? null

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