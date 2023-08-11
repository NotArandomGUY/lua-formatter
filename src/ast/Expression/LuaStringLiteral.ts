import { StringLiteral } from 'luaparse'
import LuaScope from '../LuaScope'
import LuaExpression from '../Node/LuaExpression'
import LuaIdentifier from './LuaIdentifier'

export default class LuaStringLiteral extends LuaExpression<'StringLiteral'> {
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

  public fromJson(obj: StringLiteral): this {
    super.fromJson(obj)

    const { value, raw } = obj

    this.value = value.replace(/^\r/, '')
    this.raw = raw

    return this
  }

  public toJson(): StringLiteral {
    const { value, raw } = this

    return Object.assign(super.toJson(), <StringLiteral>{
      value,
      raw
    })
  }

  public toString(): string {
    const { value, raw } = this

    // Multi-line string
    if (raw.startsWith('[[')) return `[[${value.startsWith('\n') ? '\n' : ''}${this.getEncodedValue()}]]`

    return `'${this.getEncodedValue().replace(/'/g, '\\\'')}'`
  }

  protected async visitNested(): Promise<void> {
    return
  }

  private getEncodedValue(): string {
    const { value, raw } = this

    if (/[\uf780-\uf7ff]/.test(value)) return raw.startsWith('[[') ? raw.slice(2, -2) : raw.slice(1, -1)

    return value
      .replace(/[\x07\x08\x0C\x0A\x0D\x09\x0B\x5C]/g, c => { // NOSONAR
        switch (c) {
          case '\x07':
            return '\\a'
          case '\x08':
            return '\\b'
          case '\x0C':
            return '\\f'
          case '\x0A':
            return '\\n'
          case '\x0D':
            return '\\r'
          case '\x09':
            return '\\t'
          case '\x0B':
            return '\\v'
          case '\x5C':
            return '\\\\'
          default:
            return c
        }
      })
      .replace(/[^ -~]+/g, c => `\\${c.charCodeAt(0).toString().padStart(3, '0')}`)
  }
}