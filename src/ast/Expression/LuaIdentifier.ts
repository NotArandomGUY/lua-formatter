import { Identifier } from 'luaparse'
import LuaScope from '../LuaScope'
import LuaExpression from '../Node/LuaExpression'

export default class LuaIdentifier extends LuaExpression<'Identifier'> {
  public name: string

  public constructor(scope: LuaScope) {
    super(scope)

    this.name = ''
  }

  public isMatch(identifier: LuaIdentifier): boolean {
    return this.name === identifier.name
  }

  public getReferences(): LuaIdentifier[] {
    return [this]
  }

  public clear(): this {
    super.clear()

    this.name = ''

    return this
  }

  public fromJson(obj: Identifier): this {
    super.fromJson(obj)

    const { name } = obj

    this.name = name

    return this
  }

  public toJson(): Identifier {
    const { name } = this

    return Object.assign(super.toJson(), <Identifier>{
      name
    })
  }

  public toString(): string {
    return this.name
  }

  protected visitNested(): void {
    return
  }
}