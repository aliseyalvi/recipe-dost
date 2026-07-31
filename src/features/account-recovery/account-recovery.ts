export type AccountRecoveryState =
  | 'anonymous_unlinked'
  | 'linking'
  | 'linked'
  | 'signed_out'
  | 'signing_in'
  | 'recovering'
  | 'error'

export type AuthUserLike = {
  id: string
  email?: string | null
  is_anonymous?: boolean
  email_confirmed_at?: string | null
  confirmed_at?: string | null
}

export type AuthSessionLike = {
  user: AuthUserLike
}

type LinkDependencies = {
  getSession: () => Promise<AuthSessionLike | null>
  updateEmail: (email: string) => Promise<AuthUserLike>
}

type CallbackDependencies<TSession extends AuthSessionLike> = {
  getVerifiedUser: () => Promise<AuthUserLike>
  getSession: () => Promise<TSession | null>
}

export class AuthOperationGate {
  private activeOperation: string | null = null
  private idlePromise: Promise<void> = Promise.resolve()
  private resolveIdle: (() => void) | null = null

  get isBusy() {
    return this.activeOperation !== null
  }

  get isRecoveryInProgress() {
    return (
      this.activeOperation === 'linking' ||
      this.activeOperation === 'signing_in' ||
      this.activeOperation === 'recovering'
    )
  }

  async waitUntilIdle() {
    await this.idlePromise
  }

  async run<T>(operation: string, task: () => Promise<T>) {
    if (this.activeOperation) {
      throw new Error('Another account operation is already in progress.')
    }

    this.activeOperation = operation
    this.idlePromise = new Promise<void>((resolve) => {
      this.resolveIdle = resolve
    })

    try {
      return await task()
    } finally {
      this.activeOperation = null
      this.resolveIdle?.()
      this.resolveIdle = null
    }
  }
}

export class AuthCallbackGate {
  private fingerprint: number | null = null
  private result: Promise<unknown> | null = null

  run<T>(callbackUrl: string, task: () => Promise<T>) {
    const fingerprint = getCallbackFingerprint(callbackUrl)
    if (this.fingerprint === fingerprint && this.result) {
      return this.result as Promise<T>
    }

    const result = Promise.resolve().then(task)
    this.fingerprint = fingerprint
    this.result = result
    return result
  }
}

export class SingleFlightRequestGate {
  private activeRequest: Promise<unknown> | null = null

  run<T>(task: () => Promise<T>) {
    if (this.activeRequest) {
      return this.activeRequest as Promise<T>
    }

    const request = Promise.resolve().then(task)
    this.activeRequest = request
    const clear = () => {
      if (this.activeRequest === request) this.activeRequest = null
    }
    void request.then(clear, clear)
    return request
  }
}

export async function bootstrapAuthSession<TSession extends AuthSessionLike>({
  gate,
  getSession,
  signInAnonymously,
}: {
  gate: AuthOperationGate
  getSession: () => Promise<TSession | null>
  signInAnonymously: () => Promise<TSession | null>
}) {
  const recoveryWasInProgress = gate.isRecoveryInProgress

  if (recoveryWasInProgress) {
    await gate.waitUntilIdle()
    return getSession()
  }

  return gate.run('bootstrap', async () => {
    const existingSession = await getSession()
    return existingSession ?? signInAnonymously()
  })
}

export async function requestAnonymousAccountLink({
  email,
  dependencies,
}: {
  email: string
  dependencies: LinkDependencies
}) {
  const session = await dependencies.getSession()

  if (!session?.user.is_anonymous) {
    throw new Error('A current guest session is required.')
  }

  const originalUserId = session.user.id
  const updatedUser = await dependencies.updateEmail(email)
  assertSameUserId(originalUserId, updatedUser.id)

  return { originalUserId }
}

export async function verifyAuthoritativeCallbackSession<
  TSession extends AuthSessionLike,
>({
  expectedUserId,
  expectedEmail,
  dependencies,
}: {
  expectedUserId?: string | null
  expectedEmail?: string | null
  dependencies: CallbackDependencies<TSession>
}) {
  const verifiedUser = await dependencies.getVerifiedUser()
  assertLinkedEmail(verifiedUser, expectedEmail)
  if (expectedUserId) {
    assertSameUserId(expectedUserId, verifiedUser.id)
  }

  const finalSession = await dependencies.getSession()
  if (!finalSession) {
    throw new Error('The authenticated session could not be re-read.')
  }
  assertSameUserId(verifiedUser.id, finalSession.user.id)
  assertLinkedEmail(finalSession.user, expectedEmail)
  if (expectedUserId) {
    assertSameUserId(expectedUserId, finalSession.user.id)
  }

  return finalSession
}

export function shouldConfirmGuestSwitch({
  isAnonymous,
  hasMeaningfulData,
}: {
  isAnonymous: boolean
  hasMeaningfulData: boolean
}) {
  return isAnonymous && hasMeaningfulData
}

export function getAccountRecoveryState(
  user: AuthUserLike | null
): AccountRecoveryState {
  if (!user) return 'signed_out'
  return user.is_anonymous ? 'anonymous_unlinked' : 'linked'
}

export function maskAccountEmail(email: string | null | undefined) {
  if (!email) return 'Email secured'
  const [localPart, domain] = email.split('@')
  if (!domain) return 'Email secured'

  const visibleLocal = localPart.slice(0, 1)
  const maskedLocal = `${visibleLocal}${'•'.repeat(Math.max(3, localPart.length - 1))}`
  const domainParts = domain.split('.')
  const domainName = domainParts[0] ?? ''
  const suffix = domainParts.slice(1).join('.')
  const maskedDomain = `${domainName.slice(0, 1)}${'•'.repeat(
    Math.max(2, domainName.length - 1)
  )}`

  return `${maskedLocal}@${maskedDomain}${suffix ? `.${suffix}` : ''}`
}

export function assertSameUserId(expectedUserId: string, actualUserId: string) {
  if (expectedUserId !== actualUserId) {
    throw new Error(
      'Account verification returned a different user. Your data was not migrated.'
    )
  }
}

function assertLinkedEmail(
  user: AuthUserLike,
  expectedEmail: string | null | undefined
) {
  if (
    user.is_anonymous ||
    !user.email ||
    !(user.email_confirmed_at || user.confirmed_at)
  ) {
    throw new Error('The email link did not secure an account.')
  }
  if (
    expectedEmail &&
    user.email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
  ) {
    throw new Error('The email link returned a different account.')
  }
}

function getCallbackFingerprint(callbackUrl: string) {
  let fingerprint = 2166136261
  for (let index = 0; index < callbackUrl.length; index += 1) {
    fingerprint ^= callbackUrl.charCodeAt(index)
    fingerprint = Math.imul(fingerprint, 16777619)
  }
  return fingerprint >>> 0
}
