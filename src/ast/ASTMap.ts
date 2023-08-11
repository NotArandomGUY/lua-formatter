import LuaBinaryExpression from './Expression/LuaBinaryExpression'
import LuaBooleanLiteral from './Expression/LuaBooleanLiteral'
import LuaCallExpression from './Expression/LuaCallExpression'
import LuaFunctionDeclaration from './Expression/LuaFunctionDeclaration'
import LuaIdentifier from './Expression/LuaIdentifier'
import LuaIndexExpression from './Expression/LuaIndexExpression'
import LuaLogicalExpression from './Expression/LuaLogicalExpression'
import LuaMemberExpression from './Expression/LuaMemberExpression'
import LuaNilLiteral from './Expression/LuaNilLiteral'
import LuaNumericLiteral from './Expression/LuaNumericLiteral'
import LuaStringCallExpression from './Expression/LuaStringCallExpression'
import LuaStringLiteral from './Expression/LuaStringLiteral'
import LuaTableCallExpression from './Expression/LuaTableCallExpression'
import LuaTableConstructorExpression from './Expression/LuaTableConstructorExpression'
import LuaUnaryExpression from './Expression/LuaUnaryExpression'
import LuaVarargLiteral from './Expression/LuaVarargLiteral'
import LuaChunk from './Node/LuaChunk'
import LuaComment from './Node/LuaComment'
import LuaElseClause from './Node/LuaElseClause'
import LuaElseifClause from './Node/LuaElseifClause'
import LuaIfClause from './Node/LuaIfClause'
import LuaTableKey from './Node/LuaTableKey'
import LuaTableKeyString from './Node/LuaTableKeyString'
import LuaTableValue from './Node/LuaTableValue'
import LuaAssignmentStatement from './Statement/LuaAssignmentStatement'
import LuaBreakStatement from './Statement/LuaBreakStatement'
import LuaCallStatement from './Statement/LuaCallStatement'
import LuaDoStatement from './Statement/LuaDoStatement'
import LuaForGenericStatement from './Statement/LuaForGenericStatement'
import LuaForNumericStatement from './Statement/LuaForNumericStatement'
import LuaGotoStatement from './Statement/LuaGotoStatement'
import LuaIfStatement from './Statement/LuaIfStatement'
import LuaLabelStatement from './Statement/LuaLabelStatement'
import LuaLocalStatement from './Statement/LuaLocalStatement'
import LuaRepeatStatement from './Statement/LuaRepeatStatement'
import LuaReturnStatement from './Statement/LuaReturnStatement'
import LuaWhileStatement from './Statement/LuaWhileStatement'

export default {
  LabelStatement: LuaLabelStatement,
  BreakStatement: LuaBreakStatement,
  GotoStatement: LuaGotoStatement,
  ReturnStatement: LuaReturnStatement,
  IfStatement: LuaIfStatement,
  IfClause: LuaIfClause,
  ElseifClause: LuaElseifClause,
  ElseClause: LuaElseClause,
  WhileStatement: LuaWhileStatement,
  DoStatement: LuaDoStatement,
  RepeatStatement: LuaRepeatStatement,
  LocalStatement: LuaLocalStatement,
  AssignmentStatement: LuaAssignmentStatement,
  CallStatement: LuaCallStatement,
  FunctionDeclaration: LuaFunctionDeclaration,
  ForNumericStatement: LuaForNumericStatement,
  ForGenericStatement: LuaForGenericStatement,
  Chunk: LuaChunk,
  Identifier: LuaIdentifier,
  StringLiteral: LuaStringLiteral,
  NumericLiteral: LuaNumericLiteral,
  BooleanLiteral: LuaBooleanLiteral,
  NilLiteral: LuaNilLiteral,
  VarargLiteral: LuaVarargLiteral,
  TableKey: LuaTableKey,
  TableKeyString: LuaTableKeyString,
  TableValue: LuaTableValue,
  TableConstructorExpression: LuaTableConstructorExpression,
  UnaryExpression: LuaUnaryExpression,
  BinaryExpression: LuaBinaryExpression,
  LogicalExpression: LuaLogicalExpression,
  MemberExpression: LuaMemberExpression,
  IndexExpression: LuaIndexExpression,
  CallExpression: LuaCallExpression,
  TableCallExpression: LuaTableCallExpression,
  StringCallExpression: LuaStringCallExpression,
  Comment: LuaComment
}