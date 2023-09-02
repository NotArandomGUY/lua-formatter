import List from '@/lib/list'
import { DoStatement } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from '../Node/LuaStatement'

export default class LuaDoStatement extends LuaStatement<'DoStatement'> implements ICodeBlock {
  public body: List<LuaStatement>

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

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

    this.body.clear()

    return this
  }

  public fromJson(obj: DoStatement): this {
    super.fromJson(obj)

    const { scope, body: chunkBody } = this
    const { body } = obj

    for (const statement of body) {
      chunkBody.push(LuaBase.createFromJson(statement, scope))
    }

    return this
  }

  public toJson(): DoStatement {
    const { body } = this

    return Object.assign(super.toJson(), <DoStatement>{
      body: body.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, body } = this

    const padding = isInline ? '' : ' '.repeat(indent * (scope.getDepth() - 1))

    let output = `${padding}do\n`
    output += body.map(s => s.toString(indent)).join('\n')
    output += `\n${padding}end`

    return output
  }

  public removeChild(statement: LuaStatement): boolean {
    const { body } = this

    return body.remove(body.indexOf(statement)) != null
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { scope, body } = this

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