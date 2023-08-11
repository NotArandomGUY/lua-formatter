import * as fs from 'fs'
const {
  promises,
  mkdirSync: _mkdirSync,
  statSync: _statSync,
  readFileSync: _readFileSync, writeFileSync: _writeFileSync,
  openSync: _openSync, closeSync: _closeSync, fstatSync: _fstatSync, readSync: _readSync, writeSync: _writeSync,
  renameSync: _renameSync, unlinkSync: _unlinkSync
} = fs
const {
  mkdir: _mkdir,
  stat: _stat,
  readFile: _readFile, writeFile: _writeFile,
  rename: _rename, unlink: _unlink
} = promises

// Async

export async function dirExists(path: string): Promise<boolean> {
  try { return (await _stat(path)).isDirectory() } catch (err) { return false }
}

export async function fileExists(path: string): Promise<boolean> {
  try { return (await _stat(path)).isFile() } catch (err) { return false }
}

export async function fileSize(path: string): Promise<number> {
  try { return (await _stat(path)).size } catch (err) { return -1 }
}

export async function mkdir(path: string, opts?: fs.MakeDirectoryOptions): Promise<string | undefined> {
  return _mkdir(path, opts)
}

export async function readFile(path: string): Promise<Buffer> {
  return _readFile(path)
}

export async function writeFile(path: string, data: string | Buffer): Promise<void> {
  return _writeFile(path, data)
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return _rename(oldPath, newPath)
}

export async function deleteFile(path: string): Promise<void> {
  return _unlink(path)
}

// Sync

export function dirExistsSync(path: string): boolean {
  try { return _statSync(path).isDirectory() } catch (err) { return false }
}

export function fileExistsSync(path: string): boolean {
  try { return _statSync(path).isFile() } catch (err) { return false }
}

export function fileSizeSync(path: string): number {
  try { return _statSync(path).size } catch (err) { return -1 }
}

export function statSync(path: string): fs.Stats | null {
  try { return _statSync(path) } catch (err) { return null }
}

export function mkdirSync(path: string, opts?: fs.MakeDirectoryOptions): number {
  try {
    _mkdirSync(path, opts)
    return 0
  } catch (err) {
    return -1
  }
}

export function readFileSync(path: string): Buffer | null {
  try { return _readFileSync(path) } catch (err) { return null }
}

export function writeFileSync(path: string, data: string | Buffer): number {
  try {
    _writeFileSync(path, data)
    return 0
  } catch (err) {
    return -1
  }
}

export function renameFileSync(oldPath: string, newPath: string): number {
  try {
    _renameSync(oldPath, newPath)
    return 0
  } catch (err) {
    return -1
  }
}

export function deleteFileSync(path: string): number {
  try {
    _unlinkSync(path)
    return 0
  } catch (err) {
    return -1
  }
}

export function fopenSync(path: string, flag: fs.OpenMode, mode?: fs.Mode | null): number {
  try { return _openSync(path, flag, mode) } catch (err) { return -1 }
}

export function fcloseSync(fd: number): number {
  try {
    _closeSync(fd)
    return 0
  } catch (err) {
    return -1
  }
}

export function fstatSync(fd: number, options?: fs.StatOptions): fs.Stats | fs.BigIntStats | null {
  try { return _fstatSync(fd, options) } catch (err) { return null }
}

export function freadSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number {
  try { return _readSync(fd, buffer, offset, length, position) } catch (err) { return -1 }
}

export function fwriteSync(fd: number, buffer: Buffer, offset?: number | null, length?: number | null, position?: number | null): number {
  try { return _writeSync(fd, buffer, offset, length, position) } catch (err) { return -1 }
}

export class FileReader {
  private filePath: string
  private fd: number
  private size: number

  private curPos: number
  private buffer: Buffer | null

  private lastLinePos: number

  public constructor(filePath: string) {
    this.filePath = filePath
    this.fd = -1
    this.size = -1

    this.curPos = 0
    this.buffer = null

    this.lastLinePos = 0
  }

  public getPath(): string {
    return this.filePath
  }

  public getSize(): number {
    return this.size
  }

  public isExists(): boolean {
    return fileExistsSync(this.filePath)
  }

  public isOpen(): boolean {
    return this.fd >= 0
  }

  public open(): number {
    if (this.isOpen()) return 0
    if (!this.isExists()) return -1

    this.fd = fopenSync(this.filePath, 'r')

    if (this.fd < 0) return -1

    this.size = fileSizeSync(this.filePath)

    return 0
  }

  public readBytes(readPos: number, readSize: number): Buffer | null {
    if (!this.isOpen()) return null

    const { fd, size, curPos, buffer } = this

    readPos = Math.max(0, readPos)
    readSize = Math.min(size - readPos, readSize)

    const offset = readPos - curPos

    if (buffer == null || offset < 0 || (buffer.length - offset) < readSize) {
      let cacheBuf = buffer

      // Reallocate buffer if needed
      if (cacheBuf == null || cacheBuf.length < readSize || cacheBuf.length > (size - readPos)) {
        cacheBuf = Buffer.alloc(Math.min(size - readPos, readSize * 2))
        this.buffer = cacheBuf
      }

      // Read file
      freadSync(fd, cacheBuf, 0, cacheBuf.length, readPos)
      this.curPos = readPos

      return cacheBuf.subarray(0, readSize)
    }

    // Read from cache
    return buffer.subarray(offset, offset + readSize)
  }

  public readString(readPos: number, readSize: number): string | null {
    return this.readBytes(readPos, readSize)?.toString('utf8') ?? null
  }

  public readLine(): string | null {
    const chunks: Buffer[] = []

    let pos = this.lastLinePos

    while (true) {
      const chunk = this.readBytes(pos, 33554432)

      if (chunk == null || chunk.length === 0) {
        if (chunks.length > 0) break
        return null
      }

      const newLineIndex = chunk.indexOf('\n')

      if (newLineIndex >= 0) {
        chunks.push(chunk.subarray(0, newLineIndex))
        pos += newLineIndex
        break
      }

      chunks.push(chunk)
      pos += chunk.length
    }

    this.lastLinePos = pos + 1

    return Buffer.concat(chunks).toString('utf8')
  }

  public close(): void {
    if (!this.isOpen()) return

    fcloseSync(this.fd)

    this.fd = -1
    this.size = -1

    this.curPos = 0
    this.buffer = null
  }
}