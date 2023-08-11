import { parse } from 'luaparse'
import { basename } from 'path'
import { exit } from 'process'
import LuaBase from './ast/LuaBase'
import LuaChunk from './ast/Node/LuaChunk'
import { FileReader, writeFile } from './lib/fileSystem'
import Step from './step/Step'
import FixupFunctionNameStep from './step/deobfuscate/FixupFunctionNameStep'
import InlineStep from './step/deobfuscate/InlineStep'
import StripDeadCodeStep from './step/deobfuscate/StripDeadCodeStep'
import TableConstructorStep from './step/deobfuscate/TableConstructorStep'

async function processChunk(mode: string, chunk: LuaChunk, maxIteration: number): Promise<number> {
  switch (mode) {
    case 'obfuscate':
      return 0
    case 'deobfuscate':
      await Step.create(InlineStep).apply(chunk, maxIteration)
      await Step.create(TableConstructorStep).apply(chunk, maxIteration)
      await Step.create(InlineStep).apply(chunk, maxIteration)
      await Step.create(FixupFunctionNameStep).apply(chunk, maxIteration)
      await Step.create(StripDeadCodeStep).apply(chunk, maxIteration)
      return 0
    default:
      console.log(`Invalid mode: ${mode}`)
      return -1
  }
}

async function main(argv: string[]): Promise<number> {
  const argc = argv.length

  if (argc < 4) {
    console.log(`Usage: ${basename(argv[0])} <mode> <srcPath> [dstPath]`)
    return 1
  }

  const mode = argv[2]
  const srcPath = argv[3]
  const dstPath = argv[4] ?? (srcPath.endsWith('.lua') ? srcPath.slice(0, -4) + '.ast.lua' : srcPath)

  const reader = new FileReader(srcPath)

  if (reader.open() !== 0) {
    console.log(`Failed to open file: ${reader.getPath()}`)
    return 1
  }

  const parser = parse({
    wait: true,
    locations: true,
    luaVersion: '5.3',
    encodingMode: 'x-user-defined'
  })

  let line = reader.readLine()
  let lineCount = 0

  while (line != null) {
    parser.write(line + '\n')
    line = reader.readLine()
    lineCount++
  }

  reader.close()

  await LuaBase.init()
  const ast = LuaBase.createFromJson(parser.end(''))

  if (await processChunk(mode, ast, Math.ceil(lineCount / 10)) !== 0) return 1

  await writeFile(dstPath, ast.toString())

  return 0
}

main(process.argv).then(exit).catch(err => {
  console.log(err)
  exit(1)
})