import List from '@/lib/list'
import { ElseifClause } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from './LuaExpression'
import LuaStatement from './LuaStatement'

export default class LuaElseifClause extends LuaBase<'ElseifClause'> implements ICodeBlock {
  public condition: LuaExpression | null
  public body: List<LuaStatement>

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.condition = null
    this.body = new List()
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
    this.body.clear()

    return this
  }

  public fromJson(obj: ElseifClause): this {
    super.fromJson(obj)

    const { scope, body: chunkBody } = this
    const { condition, body } = obj

    this.condition = LuaBase.createFromJson(condition, scope.parent!)

    for (const statement of body) {
      chunkBody.push(LuaBase.createFromJson(statement, scope))
    }

    return this
  }

  public toJson(): ElseifClause {
    const { condition, body } = this

    if (condition == null) throw new Error('Invalid condition expression')

    return Object.assign(super.toJson(), <ElseifClause>{
      condition: condition.toJson(),
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, condition, body } = this

    if (condition == null) throw new Error('Invalid condition expression')

    const padding = isInline ? '' : ' '.repeat(indent * (scope.getDepth() - 1))

    return `${padding}elseif ${condition.toString(indent)} then\n${body.map(s => s.toString(indent)).join('\n')}`
  }

  public removeChild(statement: LuaStatement): boolean {
    const { body } = this

    return body.remove(body.indexOf(statement)) != null
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { scope, condition, body } = this

    this.condition = await condition?.visit(pre, post, postBlock, state) ?? null

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