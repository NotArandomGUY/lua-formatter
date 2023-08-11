import { CallStatement } from 'luaparse'
import LuaCallExpression from '../Expression/LuaCallExpression'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaStringCallExpression from '../Expression/LuaStringCallExpression'
import LuaTableCallExpression from '../Expression/LuaTableCallExpression'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaStatement from '../Node/LuaStatement'

export default class LuaCallStatement extends LuaStatement<'CallStatement'> {
  public expression: LuaCallExpression | LuaStringCallExpression | LuaTableCallExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.expression = null
  }

  public getReferences(): LuaIdentifier[] {
    return this.expression?.getReferences() ?? []
  }

  public clear(): this {
    super.clear()

    this.expression = null

    return this
  }

  public fromJson(obj: CallStatement): this {
    super.fromJson(obj)

    const { expression } = obj

    this.expression = LuaBase.createFromJson(expression, this.scope)

    return this
  }

  public toJson(): CallStatement {
    const { expression } = this

    if (expression == null) throw new Error('Invalid call expression')

    return Object.assign(super.toJson(), <CallStatement>{
      expression: expression.toJson()
    })
  }

  public toString(indent = 2, isInline = false): string {
    const { scope, expression } = this

    if (expression == null) throw new Error('Invalid call expression')

    const padding = isInline ? '' : ' '.repeat(indent * scope.getDepth())

    return `${padding}${expression.toString(indent)}`
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { expression } = this

    this.expression = <typeof expression>(await expression?.visit(pre, post, postBlock, state) ?? null)
  }
}