export type RevenueCatCustomerInfoLike = {
  entitlements: {
    active: Record<string, unknown>
  }
}

type RevenueCatIdentityAdapter<TCustomerInfo extends RevenueCatCustomerInfoLike> = {
  configure: (appUserId: string) => void
  logIn: (appUserId: string) => Promise<{ customerInfo: TCustomerInfo }>
  getCustomerInfo: () => Promise<TCustomerInfo>
  logOut: () => Promise<TCustomerInfo>
}

export class RevenueCatIdentitySynchronizer<
  TCustomerInfo extends RevenueCatCustomerInfoLike,
> {
  private readonly adapter: RevenueCatIdentityAdapter<TCustomerInfo>
  private configured = false
  private configuredUserId: string | null = null
  private operation: Promise<unknown> = Promise.resolve()

  constructor(adapter: RevenueCatIdentityAdapter<TCustomerInfo>) {
    this.adapter = adapter
  }

  get currentUserId() {
    return this.configuredUserId
  }

  synchronize(appUserId: string) {
    return this.serialize(async () => {
      let customerInfo: TCustomerInfo | null = null

      if (!this.configured) {
        this.adapter.configure(appUserId)
        this.configured = true
        this.configuredUserId = appUserId
      } else if (this.configuredUserId !== appUserId) {
        const login = await this.adapter.logIn(appUserId)
        this.configuredUserId = appUserId
        customerInfo = login.customerInfo
      }

      return customerInfo ?? this.adapter.getCustomerInfo()
    })
  }

  reset() {
    return this.serialize(async () => {
      try {
        if (this.configured) {
          await this.adapter.logOut()
        }
      } finally {
        this.configured = false
        this.configuredUserId = null
      }
    })
  }

  private serialize<T>(task: () => Promise<T>) {
    const next = this.operation.then(task, task)
    this.operation = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}
