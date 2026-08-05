import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// Manages the local "saved-copies" folder that sits next to the database:
// favicons now, and (in later stories) reader-article HTML and retained PDFs.
// Keeping large content as ordinary files keeps the database lean and lets the
// user back everything up by copying a folder.
export class FileStore {
  constructor(private readonly baseDir: string) {
    this.ensure(baseDir)
  }

  private ensure(dir: string): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  private pathFor(subdir: string, name: string): string {
    const dir = join(this.baseDir, subdir)
    this.ensure(dir)
    return join(dir, name)
  }

  writeFavicon(bookmarkId: string, ext: string, data: Buffer): string {
    const p = this.pathFor('favicons', `${bookmarkId}.${ext}`)
    writeFileSync(p, data)
    return p
  }

  writeReaderCopy(bookmarkId: string, html: string): string {
    const p = this.pathFor('copies', `${bookmarkId}.html`)
    writeFileSync(p, html, 'utf8')
    return p
  }

  writePdfCopy(bookmarkId: string, data: Buffer): string {
    const p = this.pathFor('copies', `${bookmarkId}.pdf`)
    writeFileSync(p, data)
    return p
  }

  read(path: string): Buffer {
    return readFileSync(path)
  }

  remove(path: string | null | undefined): void {
    if (path && existsSync(path)) rmSync(path, { force: true })
  }
}
