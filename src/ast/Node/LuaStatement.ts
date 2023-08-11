import ASTMap from '../ASTMap'
import LuaBase from '../LuaBase'

export default abstract class LuaStatement<TType extends keyof typeof ASTMap = any> extends LuaBase<TType> { }