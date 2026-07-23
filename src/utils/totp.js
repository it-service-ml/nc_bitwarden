import { t } from '@nextcloud/l10n'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function normalizeAlgorithm(value) {
  const normalized = String(value ?? 'SHA1')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  switch (normalized) {
    case 'SHA1':
      return 'SHA-1'
    case 'SHA256':
      return 'SHA-256'
    case 'SHA512':
      return 'SHA-512'
    default:
      throw new Error(
        t(
          'nc_bitwarden',
          'Unsupported TOTP algorithm: {algorithm}',
          { algorithm: value },
        ),
      )
  }
}

function normalizeInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed)) {
    return fallback
  }

  return Math.max(minimum, Math.min(maximum, parsed))
}

function decodeBase32(value) {
  const normalized = String(value ?? '')
    .toUpperCase()
    .replace(/[\s=-]/g, '')

  if (!normalized) {
    throw new Error(
      t('nc_bitwarden', 'The TOTP secret is empty.'),
    )
  }

  const output = []
  let buffer = 0
  let bits = 0

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)

    if (index < 0) {
      throw new Error(
        t(
          'nc_bitwarden',
          'Invalid character in TOTP secret: {character}',
          { character },
        ),
      )
    }

    buffer = (buffer * 32) + index
    bits += 5

    while (bits >= 8) {
      bits -= 8
      output.push((buffer >> bits) & 0xff)

      if (bits === 0) {
        buffer = 0
      } else {
        buffer &= (1 << bits) - 1
      }
    }
  }

  if (output.length === 0) {
    throw new Error(
      t('nc_bitwarden', 'The TOTP secret is invalid.'),
    )
  }

  return new Uint8Array(output)
}

export function parseTotpValue(value) {
  const source = String(value ?? '').trim()

  if (!source) {
    throw new Error(
      t('nc_bitwarden', 'No TOTP secret is available.'),
    )
  }

  if (!/^otpauth:\/\//i.test(source)) {
    return {
      secret: source,
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
    }
  }

  let url

  try {
    url = new URL(source)
  } catch {
    throw new Error(
      t('nc_bitwarden', 'The TOTP URL is invalid.'),
    )
  }

  if (
    url.protocol.toLowerCase() !== 'otpauth:'
    || url.hostname.toLowerCase() !== 'totp'
  ) {
    throw new Error(
      t(
        'nc_bitwarden',
        'Only standard otpauth://totp/ entries are supported.',
      ),
    )
  }

  const secret = url.searchParams.get('secret')

  if (!secret) {
    throw new Error(
      t(
        'nc_bitwarden',
        'The TOTP URL does not contain a secret.',
      ),
    )
  }

  return {
    secret,
    algorithm: normalizeAlgorithm(
      url.searchParams.get('algorithm'),
    ),
    digits: normalizeInteger(
      url.searchParams.get('digits'),
      6,
      6,
      10,
    ),
    period: normalizeInteger(
      url.searchParams.get('period'),
      30,
      1,
      300,
    ),
  }
}

function counterToBytes(counter) {
  const bytes = new Uint8Array(8)
  let remaining = BigInt(counter)

  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }

  return bytes
}

async function generateHotp(key, counter, digits) {
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      counterToBytes(counter),
    ),
  )

  const offset = digest[digest.length - 1] & 0x0f

  if (offset + 3 >= digest.length) {
    throw new Error(
      'Der erzeugte TOTP-Prüfwert ist ungültig.',
    )
  }

  const binaryCode =
    ((digest[offset] & 0x7f) * 0x1000000)
    + ((digest[offset + 1] & 0xff) * 0x10000)
    + ((digest[offset + 2] & 0xff) * 0x100)
    + (digest[offset + 3] & 0xff)

  return String(binaryCode % (10 ** digits))
    .padStart(digits, '0')
}

export async function generateTotpPair(
  value,
  timestamp = Date.now(),
) {
  const configuration = parseTotpValue(value)
  const secretBytes = decodeBase32(configuration.secret)

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    {
      name: 'HMAC',
      hash: configuration.algorithm,
    },
    false,
    ['sign'],
  )

  const periodMilliseconds = configuration.period * 1000
  const counter = Math.floor(timestamp / periodMilliseconds)

  const [currentCode, nextCode] = await Promise.all([
    generateHotp(key, counter, configuration.digits),
    generateHotp(key, counter + 1, configuration.digits),
  ])

  return {
    currentCode,
    nextCode,
    period: configuration.period,
    expiresAt: (counter + 1) * periodMilliseconds,
  }
}
