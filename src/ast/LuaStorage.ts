import LuaBase from './LuaBase'

export default class LuaStorage {
  private value: LuaBase | null
  private readReferenceList: LuaBase[]
  private writeReferenceList: LuaBase[]

  public constructor(value: LuaBase | null, statement?: LuaBase) {
    this.value = null
    this.readReferenceList = []
    this.writeReferenceList = []

    this.write(value, statement)
  }

  public getReadRefCount(): number {
    return this.readReferenceList.length
  }

  public getFirstReadRef(): LuaBase | null {
    return this.readReferenceList[0] ?? null
  }

  public getLastReadRef(): LuaBase | null {
    const { readReferenceList } = this

    return readReferenceList[readReferenceList.length - 1] ?? null
  }

  public getWriteRefCount(): number {
    return this.writeReferenceList.length
  }

  public getFirstWriteRef(): LuaBase | null {
    return this.writeReferenceList[0] ?? null
  }

  public getLastWriteRef(): LuaBase | null {
    const { writeReferenceList } = this

    return writeReferenceList[writeReferenceList.length - 1] ?? null
  }

  public isUnknown(): boolean {
    return this.value == null
  }

  public read<T extends LuaBase = LuaBase>(statement?: LuaBase): T | null {
    const { value, readReferenceList } = this

    // Update read references
    if (statement != null) readReferenceList.push(statement)

    return value as T | null
  }

  public write(value: LuaBase | null, statement?: LuaBase): boolean {
    const { readReferenceList, writeReferenceList } = this

    // Reset read references & Update write references
    readReferenceList.splice(0)
    if (statement != null) writeReferenceList.push(statement)

    this.value = value

    return true
  }
}