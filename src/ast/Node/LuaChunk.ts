import List from '@/lib/list'
import { Chunk } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from './LuaStatement'

export default class LuaChunk extends LuaBase<'Chunk'> implements ICodeBlock {
  public body: List<LuaStatement>
  public comments: string[]

  public constructor(scope?: LuaScope) {
    super(scope)

    this.body = new List()
    this.comments = []
  }

  public getStatementByType<TType extends keyof typeof ASTMap, TAst extends typeof LuaStatement<TType>>(type: TAst): InstanceType<TAst>[] {
    const { body } = this

    return <InstanceType<TAst>[]>body.filter(s => s instanceof type)
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    this.body.clear()
    this.comments.splice(0)

    return this
  }

  public fromJson(obj: Chunk): this {
    this.clear()

    const { scope, body: chunkBody } = this
    const { body, comments } = obj

    for (const statement of body) {
      chunkBody.push(LuaBase.createFromJson(statement, scope))
    }

    this.comments.push(...(comments ?? []))

    return this
  }

  public toJson(): Chunk {
    const { body, comments } = this

    return Object.assign(super.toJson(), <Chunk>{
      body: body.map(s => s.toJson()),
      comments
    })
  }

  public toString(indent = 2): string {
    const { body } = this

    return body.map(s => s.toString(indent)).join('\n')
  }

  public removeChild(statement: LuaStatement): boolean {
    const { body } = this

    return body.remove(body.indexOf(statement)) != null
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { scope, body } = this

    scope.clear()
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