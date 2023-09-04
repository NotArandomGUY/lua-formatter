import { BinaryExpression } from 'luaparse'
import LuaBase, { PostVisitBlockCallback, PostVisitCallback, PreVisitCallback } from '../LuaBase'
import LuaScope from '../LuaScope'
import LuaState from '../LuaState'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export enum BinaryOperator {
  OP_INVALID,
  OP_ADD,
  OP_SUB,
  OP_MUL,
  OP_MOD,
  OP_POW,
  OP_DIV,
  OP_IDIV,
  OP_BAND,
  OP_BOR,
  OP_BXOR,
  OP_SHL,
  OP_SHR,
  OP_CONCAT,
  OP_NEQ,
  OP_EQ,
  OP_LT,
  OP_LE,
  OP_GT,
  OP_GE
}

export default class LuaBinaryExpression extends LuaExpression<'BinaryExpression'> {
  public static strToOp(str: string): BinaryOperator {
    switch (str) {
      case '+':
        return BinaryOperator.OP_ADD
      case '-':
        return BinaryOperator.OP_SUB
      case '*':
        return BinaryOperator.OP_MUL
      case '%':
        return BinaryOperator.OP_MOD
      case '^':
        return BinaryOperator.OP_POW
      case '/':
        return BinaryOperator.OP_DIV
      case '//':
        return BinaryOperator.OP_IDIV
      case '&':
        return BinaryOperator.OP_BAND
      case '|':
        return BinaryOperator.OP_BOR
      case '~':
        return BinaryOperator.OP_BXOR
      case '<<':
        return BinaryOperator.OP_SHL
      case '>>':
        return BinaryOperator.OP_SHR
      case '..':
        return BinaryOperator.OP_CONCAT
      case '~=':
        return BinaryOperator.OP_NEQ
      case '==':
        return BinaryOperator.OP_EQ
      case '<':
        return BinaryOperator.OP_LT
      case '<=':
        return BinaryOperator.OP_LE
      case '>':
        return BinaryOperator.OP_GT
      case '>=':
        return BinaryOperator.OP_GE
      default:
        return BinaryOperator.OP_INVALID
    }
  }

  public static opToStr(op: BinaryOperator): string {
    switch (op) {
      case BinaryOperator.OP_ADD:
        return '+'
      case BinaryOperator.OP_SUB:
        return '-'
      case BinaryOperator.OP_MUL:
        return '*'
      case BinaryOperator.OP_MOD:
        return '%'
      case BinaryOperator.OP_POW:
        return '^'
      case BinaryOperator.OP_DIV:
        return '/'
      case BinaryOperator.OP_IDIV:
        return '//'
      case BinaryOperator.OP_BAND:
        return '&'
      case BinaryOperator.OP_BOR:
        return '|'
      case BinaryOperator.OP_BXOR:
        return '~'
      case BinaryOperator.OP_SHL:
        return '<<'
      case BinaryOperator.OP_SHR:
        return '>>'
      case BinaryOperator.OP_CONCAT:
        return '..'
      case BinaryOperator.OP_NEQ:
        return '~='
      case BinaryOperator.OP_EQ:
        return '=='
      case BinaryOperator.OP_LT:
        return '<'
      case BinaryOperator.OP_LE:
        return '<='
      case BinaryOperator.OP_GT:
        return '>'
      case BinaryOperator.OP_GE:
        return '>='
      default:
        throw new Error('Invalid binary operator')
    }
  }

  public operator: BinaryOperator
  public left: LuaExpression | null
  public right: LuaExpression | null

  public constructor(scope: LuaScope) {
    super(scope)

    this.operator = BinaryOperator.OP_INVALID
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

    this.operator = BinaryOperator.OP_INVALID
    this.left = null
    this.right = null

    return this
  }

  public fromJson(obj: BinaryExpression): this {
    super.fromJson(obj)

    const { operator, left, right } = obj

    this.operator = LuaBinaryExpression.strToOp(operator)
    this.left = LuaBase.createFromJson(left, this.scope)
    this.right = LuaBase.createFromJson(right, this.scope)

    return this
  }

  public toJson(): BinaryExpression {
    const { operator, left, right } = this

    if (left == null) throw new Error('Invalid left expression')
    if (right == null) throw new Error('Invalid right expression')

    return Object.assign(super.toJson(), <BinaryExpression>{
      operator: LuaBinaryExpression.opToStr(operator),
      left: left.toJson(),
      right: right.toJson()
    })
  }

  public toString(): string {
    const { operator, left, right } = this

    if (left == null) throw new Error('Invalid left expression')
    if (right == null) throw new Error('Invalid right expression')

    return `(${left.toString()} ${LuaBinaryExpression.opToStr(operator)} ${right.toString()})`
  }

  protected async visitNested(pre: PreVisitCallback, post: PostVisitCallback, postBlock: PostVisitBlockCallback, state: LuaState): Promise<void> {
    const { left, right } = this

    this.left = await left?.visit(pre, post, postBlock, state) ?? null
    this.right = await right?.visit(pre, post, postBlock, state) ?? null
  }
}