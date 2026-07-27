const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function concatBytes(...parts) {
  const arrays = parts.map(part => (
    part instanceof Uint8Array
      ? part
      : new Uint8Array(part)
  ))

  const length = arrays.reduce(
    (total, array) => total + array.length,
    0,
  )

  const output = new Uint8Array(length)
  let offset = 0

  for (const array of arrays) {
    output.set(array, offset)
    offset += array.length
  }

  return output
}

function uint32(value) {
  const output = new Uint8Array(4)
  new DataView(output.buffer).setUint32(
    0,
    Number(value) >>> 0,
    false,
  )
  return output
}

function sshString(value) {
  const bytes = typeof value === 'string'
    ? textEncoder.encode(value)
    : value

  return concatBytes(
    uint32(bytes.length),
    bytes,
  )
}

function decodeBase64Url(value) {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(
      Math.ceil(value.length / 4) * 4,
      '=',
    )

  const binary = atob(normalized)
  const output = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index)
  }

  return output
}

function encodeBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length),
    )

    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function decodeBase64(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')

  const unpadded = normalized.replace(/=+$/g, '')

  if (
    !unpadded
    || !/^[A-Za-z0-9+/]+$/.test(unpadded)
  ) {
    throw new Error('Invalid SSH public key encoding.')
  }

  const padded = unpadded.padEnd(
    Math.ceil(unpadded.length / 4) * 4,
    '=',
  )

  let binary

  try {
    binary = atob(padded)
  } catch {
    throw new Error('Invalid SSH public key encoding.')
  }

  const output = new Uint8Array(binary.length)

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    output[index] = binary.charCodeAt(index)
  }

  return output
}

function readSshString(bytes, offset = 0) {
  if (offset + 4 > bytes.length) {
    throw new Error('Invalid SSH public key structure.')
  }

  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4,
  ).getUint32(0, false)

  const start = offset + 4
  const end = start + length

  if (end > bytes.length) {
    throw new Error('Invalid SSH public key structure.')
  }

  return {
    value: bytes.subarray(start, end),
    offset: end,
  }
}

function publicBlobFromLine(publicKey) {
  const parts = String(publicKey ?? '')
    .trim()
    .split(/\s+/)

  const type = parts[0] ?? ''
  const encoded = parts[1] ?? ''

  if (
    !['ssh-ed25519', 'ssh-rsa'].includes(type)
    || !encoded
  ) {
    throw new Error('Unsupported SSH public key.')
  }

  const publicBlob = decodeBase64(encoded)
  const typeField = readSshString(publicBlob)
  const embeddedType = textDecoder.decode(typeField.value)

  if (embeddedType !== type) {
    throw new Error(
      'SSH public key type does not match its data.',
    )
  }

  if (type === 'ssh-ed25519') {
    const keyField = readSshString(
      publicBlob,
      typeField.offset,
    )

    if (
      keyField.value.length !== 32
      || keyField.offset !== publicBlob.length
    ) {
      throw new Error('Invalid Ed25519 public key.')
    }
  } else {
    const exponentField = readSshString(
      publicBlob,
      typeField.offset,
    )

    const modulusField = readSshString(
      publicBlob,
      exponentField.offset,
    )

    if (
      exponentField.value.length === 0
      || modulusField.value.length === 0
      || modulusField.offset !== publicBlob.length
    ) {
      throw new Error('Invalid RSA public key.')
    }
  }

  return publicBlob
}

function sshMpint(value) {
  let bytes = value

  while (
    bytes.length > 0
    && bytes[0] === 0
  ) {
    bytes = bytes.subarray(1)
  }

  if (bytes.length === 0) {
    return sshString(new Uint8Array())
  }

  if ((bytes[0] & 0x80) !== 0) {
    bytes = concatBytes(
      new Uint8Array([0]),
      bytes,
    )
  }

  return sshString(bytes)
}

function privateBlockPadding(length) {
  const blockSize = 8
  const paddingLength = blockSize - (length % blockSize)
  const padding = new Uint8Array(paddingLength)

  for (let index = 0; index < paddingLength; index += 1) {
    padding[index] = index + 1
  }

  return padding
}

function randomUint32() {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0]
}

function openSshPrivateKey(publicBlob, privateFields) {
  const check = randomUint32()
  const unpaddedPrivateBlock = concatBytes(
    uint32(check),
    uint32(check),
    privateFields,
  )

  const privateBlock = concatBytes(
    unpaddedPrivateBlock,
    privateBlockPadding(unpaddedPrivateBlock.length),
  )

  const container = concatBytes(
    textEncoder.encode('openssh-key-v1\0'),
    sshString('none'),
    sshString('none'),
    sshString(new Uint8Array()),
    uint32(1),
    sshString(publicBlob),
    sshString(privateBlock),
  )

  const encoded = encodeBase64(container)
  const lines = encoded.match(/.{1,70}/g) ?? []

  return [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    ...lines,
    '-----END OPENSSH PRIVATE KEY-----',
    '',
  ].join('\n')
}

async function fingerprint(publicBlob) {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      publicBlob,
    ),
  )

  return `SHA256:${encodeBase64(digest).replace(/=+$/g, '')}`
}

export async function fingerprintSshPublicKey(
  publicKey,
) {
  return fingerprint(
    publicBlobFromLine(publicKey),
  )
}

function publicKeyLine(type, publicBlob, comment) {
  const suffix = comment.trim()
    ? ` ${comment.trim()}`
    : ''

  return `${type} ${encodeBase64(publicBlob)}${suffix}`
}

async function generateEd25519(comment) {
  let keyPair

  try {
    keyPair = await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true,
      ['sign', 'verify'],
    )
  } catch (error) {
    const unsupported = new Error(
      'Ed25519 key generation is not supported by this browser.',
    )
    unsupported.cause = error
    throw unsupported
  }

  const privateJwk = await crypto.subtle.exportKey(
    'jwk',
    keyPair.privateKey,
  )

  if (!privateJwk.x || !privateJwk.d) {
    throw new Error(
      'The browser did not return a complete Ed25519 key.',
    )
  }

  const publicKey = decodeBase64Url(privateJwk.x)
  const privateSeed = decodeBase64Url(privateJwk.d)
  const keyType = 'ssh-ed25519'

  const publicBlob = concatBytes(
    sshString(keyType),
    sshString(publicKey),
  )

  const privateFields = concatBytes(
    sshString(keyType),
    sshString(publicKey),
    sshString(
      concatBytes(
        privateSeed,
        publicKey,
      ),
    ),
    sshString(comment.trim()),
  )

  return {
    privateKey: openSshPrivateKey(
      publicBlob,
      privateFields,
    ),
    publicKey: publicKeyLine(
      keyType,
      publicBlob,
      comment,
    ),
    fingerprint: await fingerprint(publicBlob),
  }
}

async function generateRsa(comment, modulusLength) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )

  const privateJwk = await crypto.subtle.exportKey(
    'jwk',
    keyPair.privateKey,
  )

  const requiredFields = [
    'n',
    'e',
    'd',
    'p',
    'q',
    'qi',
  ]

  if (requiredFields.some(field => !privateJwk[field])) {
    throw new Error(
      'The browser did not return a complete RSA key.',
    )
  }

  const n = decodeBase64Url(privateJwk.n)
  const e = decodeBase64Url(privateJwk.e)
  const d = decodeBase64Url(privateJwk.d)
  const p = decodeBase64Url(privateJwk.p)
  const q = decodeBase64Url(privateJwk.q)
  const qi = decodeBase64Url(privateJwk.qi)
  const keyType = 'ssh-rsa'

  const publicBlob = concatBytes(
    sshString(keyType),
    sshMpint(e),
    sshMpint(n),
  )

  const privateFields = concatBytes(
    sshString(keyType),
    sshMpint(n),
    sshMpint(e),
    sshMpint(d),
    sshMpint(qi),
    sshMpint(p),
    sshMpint(q),
    sshString(comment.trim()),
  )

  return {
    privateKey: openSshPrivateKey(
      publicBlob,
      privateFields,
    ),
    publicKey: publicKeyLine(
      keyType,
      publicBlob,
      comment,
    ),
    fingerprint: await fingerprint(publicBlob),
  }
}

export async function generateSshKeyPair({
  algorithm = 'ed25519',
  rsaBits = 3072,
  comment = '',
} = {}) {
  if (algorithm === 'ed25519') {
    return generateEd25519(comment)
  }

  if (algorithm === 'rsa') {
    const modulusLength = Number(rsaBits)

    if (![3072, 4096].includes(modulusLength)) {
      throw new Error('Unsupported RSA key size.')
    }

    return generateRsa(
      comment,
      modulusLength,
    )
  }

  throw new Error('Unsupported SSH key algorithm.')
}
