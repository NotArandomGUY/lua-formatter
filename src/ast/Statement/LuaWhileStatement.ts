import { WhileStatement } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaStatement from '../Node/LuaStatement'

export default class LuaWhileStatement extends LuaStatement<'WhileStatement'> implements ICodeBlock {
  public condition: LuaExpression | null
  public body: LuaStatement[]

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.condition = null
    this.body = []
  }

  public getStatementByType<TType extends keyof typeof ASTMap, TAst extends typeof LuaStatement<TType>>(type: TAst): InstanceType<TAst>[] {
    const { body } = this

    return <InstanceType<TAst>[]>body.filter(s => s instanceof type)
  }

  public getReferences(): LuaIdentifier[] {
    return this.condition?.getReferences() ?? []
  }

  public clear(): this {
    super.clear()

    this.condition = null
    this.body.splice(0)

    return this
  }

  public fromJson(obj: WhileStatement): this {
    super.fromJson(obj)

    const { condition, body } = obj

    this.condition = LuaBase.createFromJson(condition, this.scope.parent!)
    this.body.push(...body.map(s => LuaBase.createFromJson(s, this.scope)))

    return this
  }

  public toJson(): WhileStatement {
    const { condition, body } = this

    if (condition == null) throw new Error('Invalid condition expression')

    return Object.assign(super.toJson(), <WhileStatement>{
      condition: condition.toJson(),
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, condition, body } = this

    if (condition == null) throw new Error('Invalid condition expression')

    const padding = isInline ? '' : ' '.repeat(indent * (scope.getDepth() - 1))

    let output = `${padding}while ${condition.toString(indent)} do\n`
    output += body.map(s => s.toString(indent)).join('\n')
    output += `\n${padding}end`

    return output
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { scope, condition, body } = this

    this.condition = condition?.visit(pre, post, postBlock, state) ?? null

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