/**
 * 暴露给插件的 utils（对齐 lx-music-desktop 的 utils.crypto / utils.buffer）
 * 插件运行在 vm 沙箱中，其内部的 TypedArray 与宿主不是同一个 realm，
 * 因此所有入参都先归一化成宿主 Buffer 再交给 node 原生模块。
 */

import crypto from 'crypto'
import zlib from 'zlib'

const BUFFER_FORMATS = {
  hex: 'hex',
  base64: 'base64',
  base64url: 'base64url',
  utf8: 'utf8',
  'utf-8': 'utf8',
  ascii: 'ascii',
  binary: 'latin1',
  latin1: 'latin1',
  ucs2: 'ucs2',
  utf16le: 'utf16le',
}

function toHostBuffer(input, encoding = 'utf8') {
  if (input == null) return Buffer.alloc(0)
  if (Buffer.isBuffer(input)) return input
  if (typeof input === 'string') return Buffer.from(input, BUFFER_FORMATS[encoding] ?? encoding)
  if (input instanceof ArrayBuffer) return Buffer.from(input)
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength)
  if (Array.isArray(input)) return Buffer.from(input)
  return Buffer.from(String(input))
}

function normalizeCipherMode(mode, fallback = 'aes-128-cbc') {
  const value = String(mode || fallback)
  return (/^aes-/i.test(value) ? value : `aes-128-${value}`).toLowerCase()
}

function normalizeIv(mode, iv) {
  const buffer = toHostBuffer(iv)
  if (buffer.length === 0) return mode.endsWith('-ecb') ? null : buffer
  return buffer
}

function normalizeError(err) {
  if (err instanceof Error) return err
  // 插件运行在 vm 沙箱中，其 Error 与宿主不属于同一 realm，只能按结构识别
  if (err && typeof err === 'object' && typeof err.message === 'string') {
    const error = new Error(err.message)
    if (err.stack) error.stack = err.stack
    return error
  }
  if (typeof err === 'string') return new Error(err)
  const serialized = JSON.stringify(err)
  return new Error(serialized && serialized !== '{}' ? serialized : String(err))
}

export const pluginUtils = {
  crypto: {
    aesEncrypt(data, mode, key, iv) {
      const cipherMode = normalizeCipherMode(mode)
      const cipher = crypto.createCipheriv(cipherMode, toHostBuffer(key), normalizeIv(cipherMode, iv))
      return Buffer.concat([cipher.update(toHostBuffer(data)), cipher.final()])
    },

    aesDecrypt(data, mode, key, iv) {
      const cipherMode = normalizeCipherMode(mode)
      const decipher = crypto.createDecipheriv(cipherMode, toHostBuffer(key), normalizeIv(cipherMode, iv))
      return Buffer.concat([decipher.update(toHostBuffer(data)), decipher.final()])
    },

    rsaEncrypt(data, key, padding = crypto.constants.RSA_PKCS1_OAEP_PADDING) {
      return crypto.publicEncrypt({ key: toHostBuffer(key), padding }, toHostBuffer(data))
    },

    rsaDecrypt(data, key, padding = crypto.constants.RSA_PKCS1_OAEP_PADDING) {
      return crypto.privateDecrypt({ key: toHostBuffer(key), padding }, toHostBuffer(data))
    },

    randomBytes(length) {
      return crypto.randomBytes(Number(length) || 0)
    },

    md5(data) {
      return crypto.createHash('md5').update(toHostBuffer(data)).digest('hex')
    },

    sha1(data) {
      return crypto.createHash('sha1').update(toHostBuffer(data)).digest('hex')
    },

    createHash(algorithm) {
      return crypto.createHash(algorithm)
    },

    createHmac(algorithm, key) {
      return crypto.createHmac(algorithm, toHostBuffer(key))
    },

    createCipheriv(algorithm, key, iv) {
      return crypto.createCipheriv(algorithm, toHostBuffer(key), toHostBuffer(iv))
    },

    createDecipheriv(algorithm, key, iv) {
      return crypto.createDecipheriv(algorithm, toHostBuffer(key), toHostBuffer(iv))
    },
  },

  buffer: {
    bufToString(buf, format = 'base64') {
      const encoding = BUFFER_FORMATS[String(format).toLowerCase()] ?? format
      return toHostBuffer(buf, 'binary').toString(encoding)
    },

    strToBuf(str, format = 'base64') {
      const encoding = BUFFER_FORMATS[String(format).toLowerCase()] ?? format
      return Buffer.from(String(str ?? ''), encoding)
    },

    from(input, format = 'utf8') {
      return toHostBuffer(input, format)
    },

    isBuffer: Buffer.isBuffer,
  },

  zlib: {
    inflate: (data, callback) => zlib.inflate(toHostBuffer(data), wrap(callback)),
    deflate: (data, callback) => zlib.deflate(toHostBuffer(data), wrap(callback)),
    gzip: (data, callback) => zlib.gzip(toHostBuffer(data), wrap(callback)),
    gunzip: (data, callback) => zlib.gunzip(toHostBuffer(data), wrap(callback)),
    inflateRaw: (data, callback) => zlib.inflateRaw(toHostBuffer(data), wrap(callback)),
    brotliDecompress: (data, callback) => zlib.brotliDecompress(toHostBuffer(data), wrap(callback)),
  },
}

function wrap(callback) {
  return (err, result) => callback(err ? normalizeError(err) : null, result)
}

export { toHostBuffer, normalizeError }
export default pluginUtils
