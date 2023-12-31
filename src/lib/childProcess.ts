import { ChildProcess, exec, spawn } from 'child_process'
import { cwd, kill } from 'process'

export function quoteSpaces(arg: string) {
  return arg.includes(' ') ? `"${arg.replace(/"/, '\\"')}"` : arg
}

export function execCommand(cmd: string, stdin?: string, env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const cp = exec(cmd, { env, cwd: cwd(), maxBuffer: 100 * 1024 * 1024 })

    if (stdin != null) {
      cp.stdin?.write(stdin)
      cp.stdin?.end()
    }

    const buffer: string[] = []

    cp.stdout?.setEncoding('utf8')
    cp.stdout?.on('data', data => buffer.push(data))
    cp.stderr?.setEncoding('utf8')
    cp.stderr?.on('data', data => buffer.push(data))
    cp.on('exit', () => resolve(buffer))
    cp.on('error', (err) => reject(err))
  })
}

export function attachedSpawn(path: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const cp = spawn(path, args, { env, cwd: cwd(), stdio: 'pipe' })
    cp.on('spawn', () => resolve(cp))
    cp.on('error', (err) => reject(err))
  })
}

export function detachedSpawn(path: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const cp = spawn(`"${path}"`, args.map(quoteSpaces), {
      env,
      cwd: cwd(),
      shell: true,
      detached: true,
      stdio: 'ignore'
    })
    cp.unref()
    cp.on('spawn', () => resolve(cp))
    cp.on('error', (err) => reject(err))
  })
}

export function isProcessRunning(pid: number): boolean {
  try {
    kill(pid, 0)
    return true
  } catch (err) {
    return false
  }
}