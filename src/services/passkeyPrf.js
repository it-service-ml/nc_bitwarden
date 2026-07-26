const TEST_TIMEOUT_MS = 90_000
const PRF_OUTPUT_LENGTH = 32

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

export async function inspectPasskeyPrfEnvironment() {
  const secureContext = globalThis.isSecureContext === true

  const webAuthnAvailable = (
    typeof globalThis.PublicKeyCredential === 'function'
    && typeof globalThis.navigator?.credentials?.create === 'function'
    && typeof globalThis.navigator?.credentials?.get === 'function'
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

  if (!environment.secureContext) {
    return {
      supported: false,
      reason: 'insecure_context',
      environment,
    }
  }

  if (!environment.webAuthnAvailable) {
    return {
      supported: false,
      reason: 'webauthn_unavailable',
      environment,
    }
  }

  const registrationChallenge = randomBytes()
  const authenticationChallenge = randomBytes()
  const testUserId = randomBytes()
  const prfInput = randomBytes()

  let outputBytes = null

  try {
    const credential = await globalThis.navigator.credentials.create({
      publicKey: {
        challenge: registrationChallenge,
        rp: {
          name: 'Warden PRF capability test',
        },
        user: {
          id: testUserId,
          name: `warden-prf-test-${Date.now()}`,
          displayName: 'Warden PRF capability test',
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
        extensions: {
          prf: {},
        },
      },
    })

    if (
      !credential
      || typeof credential.getClientExtensionResults !== 'function'
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

    const allowCredential = {
      type: 'public-key',
      id: credential.rawId,
    }

    if (
      typeof credential.response?.getTransports === 'function'
    ) {
      const transports = credential.response.getTransports()

      if (Array.isArray(transports) && transports.length > 0) {
        allowCredential.transports = transports
      }
    }

    const assertion = await globalThis.navigator.credentials.get({
      publicKey: {
        challenge: authenticationChallenge,
        allowCredentials: [
          allowCredential,
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

    const authenticationExtensions
      = assertion?.getClientExtensionResults?.()

    outputBytes = toUint8Array(
      authenticationExtensions?.prf?.results?.first,
    )

    if (
      !outputBytes
      || outputBytes.byteLength !== PRF_OUTPUT_LENGTH
    ) {
      return {
        supported: false,
        reason: 'prf_output_unavailable',
        environment,
        authenticatorAttachment:
          credential.authenticatorAttachment ?? null,
      }
    }

    return {
      supported: true,
      reason: 'supported',
      environment,
      outputLength: outputBytes.byteLength,
      authenticatorAttachment:
        credential.authenticatorAttachment ?? null,
    }
  } catch (exception) {
    const exceptionName = exception?.name ?? ''

    if (exceptionName === 'NotAllowedError') {
      return {
        supported: false,
        reason: 'cancelled',
        environment,
      }
    }

    if (exceptionName === 'NotSupportedError') {
      return {
        supported: false,
        reason: 'not_supported',
        environment,
      }
    }

    if (exceptionName === 'SecurityError') {
      return {
        supported: false,
        reason: 'security_error',
        environment,
      }
    }

    if (exceptionName === 'ConstraintError') {
      return {
        supported: false,
        reason: 'user_verification_unavailable',
        environment,
      }
    }

    throw exception
  } finally {
    registrationChallenge.fill(0)
    authenticationChallenge.fill(0)
    testUserId.fill(0)
    prfInput.fill(0)
    outputBytes?.fill(0)
  }
}
