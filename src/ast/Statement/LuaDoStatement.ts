import { DoStatement } from 'luaparse'
import ASTMap from '../ASTMap'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { ICodeBlock, PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from '../Node/LuaStatement'

export default class LuaDoStatement extends LuaStatement<'DoStatement'> implements ICodeBlock {
  public body: LuaStatement[]

  public constructor(parentScope: LuaScope) {
    super()

    this.scope.parent = parentScope

    this.body = []
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

    this.body.splice(0)

    return this
  }

  public fromJson(obj: DoStatement): this {
    super.fromJson(obj)

    const { body } = obj

    this.body.push(...body.map(s => LuaBase.createFromJson(s, this.scope)))

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

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { scope, body } = this

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