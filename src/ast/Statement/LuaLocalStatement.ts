import { LocalStatement } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaStatement from '../Node/LuaStatement'

export default class LuaLocalStatement extends LuaStatement<'LocalStatement'> {
  public variables: LuaIdentifier[]
  public init: LuaExpression[]

  public constructor(scope: LuaScope) {
    super(scope)

    this.variables = []
    this.init = []
  }

  public getReferences(): LuaIdentifier[] {
    const { init } = this
    const references: LuaIdentifier[] = []

    for (const varInit of init) references.push(...varInit.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.variables.splice(0)
    this.init.splice(0)

    return this
  }

  public fromJson(obj: LocalStatement): this {
    super.fromJson(obj)

    const { variables, init } = obj

    this.variables.push(...variables.map(s => LuaBase.createFromJson(s, this.scope)))
    this.init.push(...init.map(s => LuaBase.createFromJson(s, this.scope)))

    return this
  }

  public toJson(): LocalStatement {
    const { variables, init } = this

    return Object.assign(super.toJson(), <LocalStatement>{
      variables: variables.map(i => i.toJson()),
      init: init.map(s => s.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, variables, init } = this

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    let output = `${padding}local ${variables.map(i => i.toString()).join(', ')}`
    if (init.length > 0) output += ` = ${init.map(e => e.toString(indent, true)).join(', ')}`

    return output
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { variables, init } = this

    for (let i = 0; i < variables.length; i++) {
      variables[i] = <typeof variables[0]><unknown>(await variables[i].visit(pre, post, postBlock, state))
    }

    for (let i = 0; i < init.length; i++) {
      init[i] = await init[i].visit(pre, post, postBlock, state)
    }
  }
}