import { access, constants, createWriteStream, existsSync, mkdirSync, readFileSync, unlink, writeFileSync } from 'fs'
import { get } from 'https'
import { join } from "path"
import { cwd } from 'process'
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    access(dest, constants.F_OK, (accessErr) => {
      if (accessErr === null) return reject(new Error('file already exists'))

      const request = get(url, response => {
        if (response.statusCode === 200) {
          const file = createWriteStream(dest, { flags: 'wx' })

          file.on('finish', () => resolve())
          file.on('error', err => {
            file.close()
            if (err.code === 'EEXIST') reject(new Error('file already exists'))
            else unlink(dest, () => reject(err.message)) // Delete temp file
          })

          response.pipe(file)
        } else if (response.statusCode === 302 || response.statusCode === 301) {
          download(response.headers.location, dest).then(() => resolve())
        } else {
          reject(new Error(`server responded with ${response.statusCode}: ${response.statusMessage}`))
        }
      })

      request.on('error', err => reject(err.message))
    })
  })
}

const packageConfig = (await import('./package.json', { assert: { type: 'json' } })).default
const supportedNodeVersions = Object.keys((await import('pkg-fetch/patches/patches.json', { assert: { type: 'json' } })).default).map(v => v.slice(1))
const pkgFetchVersion = `v${(await import('pkg-fetch/package.json', { assert: { type: 'json' } })).default.version.split('.').slice(0, 2).join('.')}`
const cachePath = join(process.env['PKG_CACHE_PATH'], pkgFetchVersion)

function getTargetInfo(target) {
  const targetVersion = target.match(/node(.*?)-/)[1]
  const targetOS = target.match(/node.*?-([a-zA-Z0-9]*)/)[1]
  const nodeVersion = supportedNodeVersions.find(v => v.split('.')[0] === targetVersion)

  return {
    nodeVersion,
    fetchedPath: join(cachePath, `fetched-v${nodeVersion}-${targetOS}-x64`),
    builtPath: join(cachePath, `built-v${nodeVersion}-${targetOS}-x64`),
    url: `https://github.com/vercel/pkg-fetch/releases/download/${pkgFetchVersion}/node-v${nodeVersion}-${targetOS}-x64`,
    os: targetOS
  }
}

function checkExistingBuild(builtPath, versionSegments) {
  const buildVersion = `${versionSegments[0]}.${versionSegments[1]}.${versionSegments[2]}.${versionSegments[3]}`

  if (!existsSync(builtPath)) return false

  const builtExe = NtExecutable.from(readFileSync(builtPath))
  const builtRes = NtExecutableResource.from(builtExe)

  const builtViList = Resource.VersionInfo.fromEntries(builtRes.entries)
  const builtVersion = builtViList[0].getStringValues({ lang: 1033, codepage: 1200 })?.['FileVersion']

  if (buildVersion === builtVersion) {
    console.log('using existing build')
    return true
  }

  console.log('version changed, rebuilding...')
  return false
}

export default async () => { // NOSONAR
  const targets = packageConfig.pkg.targets.map(getTargetInfo)

  for (let target of targets) {
    const { nodeVersion, fetchedPath, builtPath, url, os } = target

    const versionSegments = `${packageConfig.version.replace('-', '.')}`.split('.').map(v => parseInt(v))
    while (versionSegments.length < 4) versionSegments.push(0)

    console.log('target:', nodeVersion, os)

    if (os === 'win' && checkExistingBuild(builtPath, versionSegments)) continue

    if (!existsSync(fetchedPath)) {
      console.log('downloading file...')

      // attemp to create directory
      try { mkdirSync(cachePath, { recursive: true }) } catch (e) { console.error(e) }

      // attemp to download file
      try {
        await download(url, fetchedPath)
      } catch (e) {
        console.error(e)
        process.exit(1)
      }
      console.log('downloaded file.')
    } else {
      console.log('using existing file')
    }

    if (os !== 'win') {
      console.log('not EXE, skip')
      writeFileSync(builtPath, readFileSync(fetchedPath))
      return
    }

    console.log('reading EXE')

    const exe = NtExecutable.from(readFileSync(fetchedPath))
    const res = NtExecutableResource.from(exe)

    const viList = Resource.VersionInfo.fromEntries(res.entries)
    const vi = viList[0]

    console.log(vi.data.strings)

    console.log('removing OriginalFilename')
    vi.removeStringValue({ lang: 1033, codepage: 1200 }, 'OriginalFilename')
    console.log('removing InternalName')
    vi.removeStringValue({ lang: 1033, codepage: 1200 }, 'InternalName')

    console.log('setting Product Version')
    vi.setProductVersion(versionSegments[0], versionSegments[1], versionSegments[2], versionSegments[3], 1033)
    console.log('setting File Version')
    vi.setFileVersion(versionSegments[0], versionSegments[1], versionSegments[2], versionSegments[3], 1033)

    console.log('setting File Info')
    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        FileDescription: packageConfig.description,
        ProductName: packageConfig.name,
        CompanyName: '',
        LegalCopyright: packageConfig.author
      }
    )
    console.log(vi.data.strings)
    vi.outputToResourceEntries(res.entries)

    console.log('replacing Icon')
    const iconFile = Data.IconFile.from(readFileSync(join(cwd(), 'appIcon.ico')))
    Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      1033,
      iconFile.icons.map((item) => item.data)
    )
    res.outputResource(exe)

    console.log('generating EXE')
    const newBinary = exe.generate()

    console.log('saving EXE')
    writeFileSync(builtPath, Buffer.from(newBinary))
  }
}