import { Chunk } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from './LuaStatement'

export default class LuaChunk extends LuaBase<'Chunk'> implements ICodeBlock {
  public body: LuaStatement[]
  public comments: string[]

  public constructor(scope?: LuaScope) {
    super(scope)

    this.body = []
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
    this.body.splice(0)
    this.comments.splice(0)

    return this
  }

  public fromJson(obj: Chunk): this {
    this.clear()

    const { body, comments } = obj

    this.body.push(...body.map(s => LuaBase.createFromJson(s, this.scope)))
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

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { scope, body } = this

    state.push(scope)
    for (let i = 0; i < body.length; i++) {
      body[i] = await body[i].visit(pre, post, postBlock, state)
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