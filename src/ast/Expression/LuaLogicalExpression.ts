import { LogicalExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export enum LogicalOperator {
  OP_INVALID,
  OP_OR,
  OP_AND
}

export default class LuaLogicalExpression extends LuaExpression<'LogicalExpression'> {
  public static strToOp(str: string): LogicalOperator {
    switch (str) {
      case 'or':
        return LogicalOperator.OP_OR
      case 'and':
        return LogicalOperator.OP_AND
      default:
        return LogicalOperator.OP_INVALID
    }
  }

  public static opToStr(op: LogicalOperator): string {
    switch (op) {
      case LogicalOperator.OP_OR:
        return 'or'
      case LogicalOperator.OP_AND:
        return 'and'
      default:
        throw new Error('Invalid logical operator')
    }
  }

  public operator: LogicalOperator
  public left: LuaExpression | null
  public right: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.operator = LogicalOperator.OP_INVALID
    this.left = null
    this.right = null
  }

  public getReferences(): LuaIdentifier[] {
    const { left, right } = this
    const references: LuaIdentifier[] = []

    if (left != null) references.push(...left.getReferences())
    if (right != null) references.push(...right.getReferences())

    return references
  }

  public clear(): this {
    super.clear()

    this.operator = LogicalOperator.OP_INVALID
    this.left = null
    this.right = null

    return this
  }

  public fromJson(obj: LogicalExpression): this {
    super.fromJson(obj)

    const { operator, left, right } = obj

    this.operator = LuaLogicalExpression.strToOp(operator)
    this.left = LuaBase.createFromJson(left, this.scope)
    this.right = LuaBase.createFromJson(right, this.scope)

    return this
  }

  public toJson(): LogicalExpression {
    const { operator, left, right } = this

    if (left == null) throw new Error('Invalid left expression')
    if (right == null) throw new Error('Invalid right expression')

    return Object.assign(super.toJson(), <LogicalExpression>{
      operator: LuaLogicalExpression.opToStr(operator),
      left: left.toJson(),
      right: right.toJson()
    })
  }

  public toString(): string {
    const { operator, left, right } = this

    if (left == null) throw new Error('Invalid left expression')
    if (right == null) throw new Error('Invalid right expression')

    return `${left.toString()} ${LuaLogicalExpression.opToStr(operator)} ${right.toString()}`
  }

  protected visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): void {
    const { left, right } = this

    this.left = left?.visit(pre, post, postBlock, state) ?? null
    this.right = right?.visit(pre, post, postBlock, state) ?? null
  }
}