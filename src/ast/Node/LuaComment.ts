import { Comment } from 'luaparse'
import LuaIdentifier from '../Expression/LuaIdentifier'
import LuaBase from '../LuaBase'
import LuaScope from '../LuaScope'

export default class LuaComment extends LuaBase<'Comment'> {
  public value: string
  public raw: string

  public constructor(scope: LuaScope) {
    super(scope)

    this.value = ''
    this.raw = ''
  }

  public getReferences(): LuaIdentifier[] {
    return []
  }

  public clear(): this {
    super.clear()

    this.value = ''
    this.raw = ''

    return this
  }

  public fromJson(obj: Comment): this {
    super.fromJson(obj)

    const { value, raw } = obj

    this.value = value
    this.raw = raw

    return this
  }

  public toJson(): Comment {
    const { value, raw } = this

    return Object.assign(super.toJson(), <Comment>{
      value,
      raw
    })
  }

  public toString(): string {
    const { value } = this

    console.log(value)

    throw new Error('Method not implemented.')
  }

  protected visitNested(): void {
    return
  }
}