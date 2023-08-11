import { IfStatement } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaElseClause from '../Node/LuaElseClause'
import LuaElseifClause from '../Node/LuaElseifClause'
import LuaIfClause from '../Node/LuaIfClause'
import LuaStatement from '../Node/LuaStatement'

export default class LuaIfStatement extends LuaStatement<'IfStatement'> {
  public clauses: (LuaIfClause | LuaElseifClause | LuaElseClause)[]

  public constructor(scope: LuaScope) {
    super(scope)

    this.clauses = []
  }

  public getReferences(): LuaIdentifier[] {
    const { clauses } = this
    const references: LuaIdentifier[] = []

    for (const clause of clauses) references.push(...clause.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.clauses.splice(0)

    return this
  }

  public fromJson(obj: IfStatement): this {
    super.fromJson(obj)

    const { clauses } = obj

    this.clauses.push(...clauses.map(c => LuaBase.createFromJson(c, this.scope)))

    return this
  }

  public toJson(): IfStatement {
    const { clauses } = this

    return Object.assign(super.toJson(), <IfStatement>{
      clauses: clauses.map(c => c.toJson())
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, clauses } = this

    // How tf did this even happen?
    if (clauses.length === 0) return ''

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    return `${clauses.map(c => c.toString(indent)).join('\n')}\n${padding}end`
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { clauses } = this

    for (let i = 0; i < clauses.length; i++) {
      clauses[i] = <typeof clauses[0]>(await clauses[i].visit(pre, post, postBlock, state))
    }
  }
}