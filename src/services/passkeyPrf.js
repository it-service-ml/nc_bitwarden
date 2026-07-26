import { symmetricKeyToBuffer } from './crypto.js'

const encoder = new TextEncoder()

const FORMAT_VERSION = 1
const TEST_TIMEOUT_MS = 90_000
const PRF_OUTPUT_LENGTH = 32
const USER_KEY_LENGTH = 64
const AES_GCM_IV_LENGTH = 12
const AES_GCM_WRAPPED_LENGTH = 80

const WRAP_INFO = encoder.encode(
  'nc_bitwarden/passkey-unlock/wrapping-key/v1',
)

function randomBytes(length = 32) {
  const value = new Uint8Array(length)
  globalThis.crypto.getRandomValues(value)

  return value
}

function toUint8Array(value) {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    )
  }

  return null
}

function copyBytes(value) {
  const bytes = toUint8Array(value)

  return bytes
    ? Uint8Array.from(bytes)
    : null
}

function bytesToBase64Url(value) {
  const bytes = toUint8Array(value)

  if (!bytes) {
    throw new TypeError('Expected binary data.')
  }

  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function base64UrlToBytes(value) {
  if (
    typeof value !== 'string'
    || !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new TypeError('Invalid base64url value.')
  }

  const padding = '='.repeat(
    (4 - value.length % 4) % 4,
  )

  const binary = atob(
    value
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      + padding,
  )

  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function passkeyError(code, message) {
  const exception = new Error(message)
  exception.code = code

  return exception
}

function credentialTransports(credential) {
  if (
    typeof credential?.response?.getTransports
      !== 'function'
  ) {
    return []
  }

  const transports = credential.response.getTransports()

  return Array.isArray(transports)
    ? transports
    : []
}

function readPrfOutput(credential) {
  const extensionResults
    = credential?.getClientExtensionResults?.()

  return copyBytes(
    extensionResults?.prf?.results?.first,
  )
}

async function deriveWrappingKey(
  prfOutput,
  hkdfSalt,
  usages,
) {
  const material = await globalThis.crypto.subtle.importKey(
    'raw',
    prfOutput,
    'HKDF',
    false,
    ['deriveKey'],
  )

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: hkdfSalt,
      info: WRAP_INFO,
    },
    material,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    usages,
  )
}

function normalizeProviderUrl(value) {
  const candidate = String(value ?? '').trim()

  if (!candidate) {
    return ''
  }

  try {
    const parsed = new URL(candidate)

    parsed.hash = ''
    parsed.search = ''

    return parsed
      .toString()
      .replace(/\/+$/u, '')
  } catch {
    return candidate.replace(/\/+$/u, '')
  }
}

function accountContext({
  email,
  serverType,
  customUrl,
}) {
  const normalizedEmail = String(email ?? '')
    .trim()
    .toLowerCase()

  if (!normalizedEmail) {
    throw passkeyError(
      'missing_account',
      'The vault account email is missing.',
    )
  }

  return [
    'nc_bitwarden',
    'passkey-unlock',
    'v1',
    String(serverType ?? '').trim(),
    normalizeProviderUrl(customUrl),
    normalizedEmail,
  ].join('\u0000')
}

async function accountBinding(account) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(accountContext(account)),
  )

  return new Uint8Array(digest)
}

function wrappingAdditionalData(config) {
  return encoder.encode(
    [
      'nc_bitwarden',
      'passkey-unlock',
      `v${config.version}`,
      config.credential_id,
      config.account_binding,
    ].join('\u0000'),
  )
}

function sameBytes(left, right) {
  if (
    !left
    || !right
    || left.byteLength !== right.byteLength
  ) {
    return false
  }

  let difference = 0

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }

  return difference === 0
}

async function createPrfCredential({
  userName,
  displayName,
  prfInput = null,
}) {
  const challenge = randomBytes()
  const userId = randomBytes()

  try {
    const extensions = prfInput
      ? {
          prf: {
            eval: {
              first: prfInput,
            },
          },
        }
      : {
          prf: {},
        }

    return await globalThis.navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Warden',
        },
        user: {
          id: userId,
          name: userName,
          displayName,
        },
        pubKeyCredParams: [
          {
            type: 'public-key',
            alg: -7,
          },
          {
            type: 'public-key',
            alg: -257,
          },
        ],
        timeout: TEST_TIMEOUT_MS,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'cross-platform',
          residentKey: 'discouraged',
          requireResidentKey: false,
          userVerification: 'required',
        },
        extensions,
      },
    })
  } finally {
    challenge.fill(0)
    userId.fill(0)
  }
}

async function evaluatePrf({
  credentialId,
  transports,
  prfInput,
}) {
  const challenge = randomBytes()

  try {
    const descriptor = {
      type: 'public-key',
      id: credentialId,
    }

    if (
      Array.isArray(transports)
      && transports.length > 0
    ) {
      descriptor.transports = transports
    }

    const assertion
      = await globalThis.navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            descriptor,
          ],
          timeout: TEST_TIMEOUT_MS,
          userVerification: 'required',
          extensions: {
            prf: {
              eval: {
                first: prfInput,
              },
            },
          },
        },
      })

    const output = readPrfOutput(assertion)

    if (
      !output
      || output.byteLength !== PRF_OUTPUT_LENGTH
    ) {
      throw passkeyError(
        'prf_output_unavailable',
        'The authenticator did not return a valid PRF output.',
      )
    }

    return output
  } finally {
    challenge.fill(0)
  }
}

function assertPasskeyEnvironment(environment) {
  if (!environment.secureContext) {
    throw passkeyError(
      'insecure_context',
      'Passkey operations require HTTPS.',
    )
  }

  if (!environment.webAuthnAvailable) {
    throw passkeyError(
      'webauthn_unavailable',
      'WebAuthn is not available.',
    )
  }
}

function mapWebAuthnException(exception) {
  const name = exception?.name ?? ''

  if (name === 'NotAllowedError') {
    return passkeyError(
      'cancelled',
      'The passkey operation was cancelled or timed out.',
    )
  }

  if (name === 'NotSupportedError') {
    return passkeyError(
      'not_supported',
      'The authenticator does not support this operation.',
    )
  }

  if (name === 'SecurityError') {
    return passkeyError(
      'security_error',
      'The current origin or browser policy blocks WebAuthn.',
    )
  }

  if (name === 'ConstraintError') {
    return passkeyError(
      'user_verification_unavailable',
      'Required user verification is unavailable.',
    )
  }

  return exception
}

export async function inspectPasskeyPrfEnvironment() {
  const secureContext = globalThis.isSecureContext === true

  const webAuthnAvailable = (
    typeof globalThis.PublicKeyCredential === 'function'
    && typeof globalThis.navigator?.credentials?.create
      === 'function'
    && typeof globalThis.navigator?.credentials?.get
      === 'function'
  )

  let capabilitiesAvailable = false
  let clientPrfSupported = null

  if (
    webAuthnAvailable
    && typeof globalThis.PublicKeyCredential
      .getClientCapabilities === 'function'
  ) {
    try {
      const capabilities
        = await globalThis.PublicKeyCredential
          .getClientCapabilities()

      capabilitiesAvailable = true
      clientPrfSupported
        = capabilities['extension:prf'] === true
    } catch (exception) {
      console.warn(
        '[nc_bitwarden] WebAuthn capabilities could not be read:',
        exception,
      )
    }
  }

  return {
    secureContext,
    webAuthnAvailable,
    capabilitiesAvailable,
    clientPrfSupported,
  }
}

export async function testPasskeyPrf() {
  const environment = await inspectPasskeyPrfEnvironment()

  try {
    assertPasskeyEnvironment(environment)

    const credential = await createPrfCredential({
      userName: `warden-prf-test-${Date.now()}`,
      displayName: 'Warden PRF capability test',
    })

    if (
      !credential
      || typeof credential.getClientExtensionResults
        !== 'function'
    ) {
      return {
        supported: false,
        reason: 'registration_failed',
        environment,
      }
    }

    const registrationExtensions
      = credential.getClientExtensionResults()

    if (registrationExtensions.prf?.enabled !== true) {
      return {
        supported: false,
        reason: 'authenticator_prf_unavailable',
        environment,
        authenticatorAttachment:
          credential.authenticatorAttachment ?? null,
      }
    }

    const prfInput = randomBytes()
    let output = null

    try {
      output = await evaluatePrf({
        credentialId: new Uint8Array(
          credential.rawId,
        ),
        transports: credentialTransports(
          credential,
        ),
        prfInput,
      })

      return {
        supported: true,
        reason: 'supported',
        environment,
        outputLength: output.byteLength,
        authenticatorAttachment:
          credential.authenticatorAttachment ?? null,
      }
    } finally {
      prfInput.fill(0)
      output?.fill(0)
    }
  } catch (exception) {
    const mapped = mapWebAuthnException(exception)

    return {
      supported: false,
      reason: mapped.code ?? 'unexpected_error',
      environment,
    }
  }
}

export async function createPasskeyUnlockConfig(
  userKey,
  account,
) {
  const environment = await inspectPasskeyPrfEnvironment()

  assertPasskeyEnvironment(environment)

  const prfInput = randomBytes()
  const hkdfSalt = randomBytes()
  const iv = randomBytes(AES_GCM_IV_LENGTH)

  let prfOutput = null
  let rawUserKey = null

  try {
    let credential

    try {
      credential = await createPrfCredential({
        userName: String(account.email).trim(),
        displayName: 'Warden vault unlock',
        prfInput,
      })
    } catch (exception) {
      throw mapWebAuthnException(exception)
    }

    if (!credential?.rawId) {
      throw passkeyError(
        'registration_failed',
        'The passkey credential could not be created.',
      )
    }

    const registrationExtensions
      = credential.getClientExtensionResults?.() ?? {}

    if (registrationExtensions.prf?.enabled !== true) {
      throw passkeyError(
        'authenticator_prf_unavailable',
        'The authenticator does not support WebAuthn PRF.',
      )
    }

    const credentialId = new Uint8Array(
      credential.rawId,
    )

    const transports = credentialTransports(
      credential,
    )

    prfOutput = readPrfOutput(credential)

    if (
      !prfOutput
      || prfOutput.byteLength !== PRF_OUTPUT_LENGTH
    ) {
      try {
        prfOutput = await evaluatePrf({
          credentialId,
          transports,
          prfInput,
        })
      } catch (exception) {
        throw mapWebAuthnException(exception)
      }
    }

    const binding = await accountBinding(account)

    const config = {
      version: FORMAT_VERSION,
      credential_id: bytesToBase64Url(
        credentialId,
      ),
      transports,
      authenticator_attachment:
        credential.authenticatorAttachment ?? '',
      prf_input: bytesToBase64Url(prfInput),
      hkdf_salt: bytesToBase64Url(hkdfSalt),
      iv: bytesToBase64Url(iv),
      account_binding: bytesToBase64Url(binding),
    }

    const wrappingKey = await deriveWrappingKey(
      prfOutput,
      hkdfSalt,
      ['encrypt'],
    )

    rawUserKey = new Uint8Array(
      symmetricKeyToBuffer(userKey),
    )

    if (rawUserKey.byteLength !== USER_KEY_LENGTH) {
      throw passkeyError(
        'invalid_user_key',
        'The vault user key has an invalid length.',
      )
    }

    const wrappedKey
      = await globalThis.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: wrappingAdditionalData(
            config,
          ),
          tagLength: 128,
        },
        wrappingKey,
        rawUserKey,
      )

    if (
      wrappedKey.byteLength
        !== AES_GCM_WRAPPED_LENGTH
    ) {
      throw passkeyError(
        'invalid_wrapped_key',
        'The wrapped vault key has an invalid length.',
      )
    }

    return {
      ...config,
      wrapped_key: bytesToBase64Url(
        wrappedKey,
      ),
    }
  } finally {
    prfInput.fill(0)
    hkdfSalt.fill(0)
    iv.fill(0)
    prfOutput?.fill(0)
    rawUserKey?.fill(0)
  }
}

export async function unlockUserKeyWithPasskey(
  config,
  account,
) {
  if (
    !config
    || Number(config.version) !== FORMAT_VERSION
  ) {
    throw passkeyError(
      'invalid_config',
      'The saved passkey configuration is invalid.',
    )
  }

  const environment = await inspectPasskeyPrfEnvironment()
  assertPasskeyEnvironment(environment)

  const credentialId = base64UrlToBytes(
    config.credential_id,
  )

  const prfInput = base64UrlToBytes(
    config.prf_input,
  )

  const hkdfSalt = base64UrlToBytes(
    config.hkdf_salt,
  )

  const iv = base64UrlToBytes(config.iv)
  const wrappedKey = base64UrlToBytes(
    config.wrapped_key,
  )

  const savedBinding = base64UrlToBytes(
    config.account_binding,
  )

  let currentBinding = null
  let prfOutput = null
  let plaintext = null

  try {
    if (
      iv.byteLength !== AES_GCM_IV_LENGTH
      || wrappedKey.byteLength
        !== AES_GCM_WRAPPED_LENGTH
    ) {
      throw passkeyError(
        'invalid_config',
        'The saved passkey configuration is invalid.',
      )
    }

    currentBinding = await accountBinding(account)

    if (!sameBytes(savedBinding, currentBinding)) {
      throw passkeyError(
        'account_mismatch',
        'The passkey belongs to a different vault account.',
      )
    }

    try {
      prfOutput = await evaluatePrf({
        credentialId,
        transports: Array.isArray(config.transports)
          ? config.transports
          : [],
        prfInput,
      })
    } catch (exception) {
      throw mapWebAuthnException(exception)
    }

    const wrappingKey = await deriveWrappingKey(
      prfOutput,
      hkdfSalt,
      ['decrypt'],
    )

    try {
      plaintext = new Uint8Array(
        await globalThis.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv,
            additionalData: wrappingAdditionalData(
              config,
            ),
            tagLength: 128,
          },
          wrappingKey,
          wrappedKey,
        ),
      )
    } catch {
      throw passkeyError(
        'decrypt_failed',
        'The encrypted vault key could not be decrypted.',
      )
    }

    if (plaintext.byteLength !== USER_KEY_LENGTH) {
      throw passkeyError(
        'invalid_user_key',
        'The decrypted vault key has an invalid length.',
      )
    }

    return {
      encKey: plaintext.slice(0, 32).buffer,
      macKey: plaintext.slice(32, 64).buffer,
    }
  } finally {
    credentialId.fill(0)
    prfInput.fill(0)
    hkdfSalt.fill(0)
    iv.fill(0)
    wrappedKey.fill(0)
    savedBinding.fill(0)
    currentBinding?.fill(0)
    prfOutput?.fill(0)
    plaintext?.fill(0)
  }
}
