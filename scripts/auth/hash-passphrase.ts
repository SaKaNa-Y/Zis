import type { Options } from '@node-rs/argon2'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { hash } from '@node-rs/argon2'

const MINIMUM_PASSPHRASE_BYTES = 32

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 65_536,
  outputLen: 32,
  parallelism: 1,
  timeCost: 3,
} as const satisfies Options

export async function hashPassphrase(passphrase: string): Promise<string> {
  if (new TextEncoder().encode(passphrase).byteLength < MINIMUM_PASSPHRASE_BYTES)
    throw new Error('Generated passphrase must contain at least 32 bytes')

  return hash(passphrase, ARGON2_OPTIONS)
}

async function main(): Promise<void> {
  if (process.stdin.isTTY)
    throw new Error('Refusing terminal input: pipe a securely prompted passphrase over stdin')

  const passphrase = readFileSync(0, 'utf8').replace(/\r?\n$/, '')
  const digest = await hashPassphrase(passphrase)
  process.stdout.write(`${digest}\n`)
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Passphrase hashing failed'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
