import { Parser, parse } from 'luaparse'
import { basename, dirname, join } from 'path'
import { exit } from 'process'
import LuaBase from './ast/LuaBase'
import LuaChunk from './ast/Node/LuaChunk'
import { execCommand } from './lib/childProcess'
import { FileReader, deleteFile, fileExists, writeFile } from './lib/fileSystem'
import { xorShiftDecode } from './lib/xor'
import Step from './step/Step'
import FixupFunctionNameStep from './step/deobfuscate/FixupFunctionNameStep'
import InlineStep from './step/deobfuscate/InlineStep'
import StripDeadCodeStep from './step/deobfuscate/StripDeadCodeStep'
import TableConstructorStep from './step/deobfuscate/TableConstructorStep'

const SHELL_MAGIC = Buffer.from([0x57, 0x39, 0x14, 0x32])
const LUA_MAGIC = Buffer.from([0x1B, 0x4C, 0x75, 0x61])

async function processChunk(mode: string, chunk: LuaChunk, maxIteration: number): Promise<number> {
  maxIteration = Math.max(32, maxIteration)

  switch (mode) {
    case 'obfuscate': {
      return 0
    }
    case 'deobfuscate': {
      let totalIteration = 0
      do {
        totalIteration = 0
        totalIteration += await Step.create(InlineStep).apply(chunk, maxIteration)
        totalIteration += await Step.create(TableConstructorStep).apply(chunk, maxIteration)
      } while (totalIteration > 2)

      await Step.create(InlineStep).apply(chunk, maxIteration)
      await Step.create(FixupFunctionNameStep).apply(chunk, maxIteration)
      await Step.create(StripDeadCodeStep).apply(chunk, maxIteration)
      return 0
    }
    default: {
      console.log(`Invalid mode: ${mode}`)
      return -1
    }
  }
}

async function readLuacFile(dir: string, reader: FileReader, parser: Parser, isXorShift: boolean): Promise<number> {
  let buf = reader.readBytes(0, reader.getSize())

  if (buf == null) return -1
  if (isXorShift) buf = <Buffer>xorShiftDecode(buf, 0, true)

  const magic = buf.subarray(0, 4)

  if (magic.compare(LUA_MAGIC) !== 0) {
    console.log(`Invalid luac: ${magic.toString('hex').toUpperCase()}`)
    return -1
  }

  const version = buf[4].toString(16).padStart(2, '0')
  const format = buf[5].toString(16).padStart(2, '0')
  const tmpPath = reader.getPath() + '.tmp'

  const decompilerPath = join(dir, `decompiler-${version}${format}.exe`)

  if (!await fileExists(decompilerPath)) {
    console.log(`Failed to find decompiler at: ${decompilerPath}`)
    return -1
  }

  await writeFile(tmpPath, buf)

  try {
    const lines = (await execCommand(`"${decompilerPath.replace(/"/g, '\\"')}" "${tmpPath.replace(/"/g, '\\"')}"`)).split('\n')
    let lineCount = 0

    if (lines[0]?.startsWith('Exception in')) {
      console.log(lines.join('\n'))
      return -1
    }

    for (const line of lines) {
      parser.write(line + '\n')
      lineCount++
    }

    return Math.ceil(lineCount / 10)
  } finally {
    await deleteFile(tmpPath)
  }
}

async function readLuaFile(reader: FileReader, parser: Parser): Promise<number> {
  let line = reader.readLine()
  let lineCount = 0

  while (line != null) {
    parser.write(line + '\n')
    line = reader.readLine()
    lineCount++
  }

  return Math.ceil(lineCount / 10)
}

async function readFile(dir: string, reader: FileReader, parser: Parser): Promise<number> {
  const magic = reader.readBytes(0, 4)

  const isShell = magic != null && Buffer.compare(magic, SHELL_MAGIC) === 0
  const isLuac = magic != null && Buffer.compare(magic, LUA_MAGIC) === 0

  return (isShell || isLuac) ? readLuacFile(dir, reader, parser, isShell) : readLuaFile(reader, parser)
}

async function main(argv: string[]): Promise<number> {
  const argc = argv.length

  if (argc < 4) {
    console.log(`Usage: ${basename(argv[0])} <mode> <srcPath> [dstPath]`)
    return 1
  }

  const mode = argv[2]
  const srcPath = argv[3]
  const dstPath = argv[4] ?? srcPath.replace(/(\.lua$|\.luac$|$)/, '.ast.lua')

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

  const result = await readFile(dirname(argv[0]), reader, parser)

  reader.close()

  if (result < 0) {
    console.log(`Failed to read file: ${reader.getPath()}`)
    return 1
  }

  await LuaBase.init()
  const ast = LuaBase.createFromJson(parser.end(''))

  if (await processChunk(mode, ast, result) !== 0) return 1

  await writeFile(dstPath, ast.toString())

  return 0
}

main(process.argv).then(exit).catch(err => {
  console.log(err)
  exit(1)
})