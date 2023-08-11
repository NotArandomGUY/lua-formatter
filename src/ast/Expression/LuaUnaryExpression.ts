import { UnaryExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export enum UnaryOperator {
  OP_INVALID,
  OP_NOT,
  OP_UNM,
  OP_BNOT,
  OP_LEN
}

export default class LuaUnaryExpression extends LuaExpression<'UnaryExpression'> {
  public static strToOp(str: string): UnaryOperator {
    switch (str) {
      case 'not':
        return UnaryOperator.OP_NOT
      case '-':
        return UnaryOperator.OP_UNM
      case '~':
        return UnaryOperator.OP_BNOT
      case '#':
        return UnaryOperator.OP_LEN
      default:
        return UnaryOperator.OP_INVALID
    }
  }

  public static opToStr(op: UnaryOperator): string {
    switch (op) {
      case UnaryOperator.OP_NOT:
        return 'not'
      case UnaryOperator.OP_UNM:
        return '-'
      case UnaryOperator.OP_BNOT:
        return '~'
      case UnaryOperator.OP_LEN:
        return '#'
      default:
        throw new Error('Invalid unary operator')
    }
  }

  public operator: UnaryOperator
  public argument: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.operator = UnaryOperator.OP_INVALID
    this.argument = null
  }

  public getReferences(): LuaIdentifier[] {
    return this.argument?.getReferences() ?? []
  }

  public clear(): this {
    super.clear()

    this.operator = UnaryOperator.OP_INVALID
    this.argument = null

    return this
  }

  public fromJson(obj: UnaryExpression): this {
    super.fromJson(obj)

    const { operator, argument } = obj

    this.operator = LuaUnaryExpression.strToOp(operator)
    this.argument = LuaBase.createFromJson(argument, this.scope)

    return this
  }

  public toJson(): UnaryExpression {
    const { operator, argument } = this

    if (argument == null) throw new Error('Invalid argument expression')

    return Object.assign(super.toJson(), <UnaryExpression>{
      operator: LuaUnaryExpression.opToStr(operator),
      argument: argument.toJson()
    })
  }

  public toString(): string {
    const { operator, argument } = this

    if (argument == null) throw new Error('Invalid argument expression')

    const opStr = LuaUnaryExpression.opToStr(operator)

    return `${opStr}${opStr.length > 1 ? ' ' : ''}${argument.toString()}`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { argument } = this

    this.argument = argument?.visit(pre, post, postBlock, state) ?? null
  }
}