import { supabase } from '@/lib/supabase/client'

type DeleteAccountResponse =
  | { ok: true; data: { deleted: true } }
  | { ok: false; error: { code: string; message: string } }

export class AccountDeletionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AccountDeletionError'
  }
}

export async function deleteCurrentAccount() {
  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>(
    'delete-account',
    { method: 'POST' }
  )

  if (error) {
    throw new AccountDeletionError(
      'network_or_session',
      'Account deletion could not be completed. Check your connection and sign in again.'
    )
  }

  if (!data?.ok) {
    throw new AccountDeletionError(
      data?.error.code ?? 'deletion_failed',
      data?.error.message ??
        'Account deletion could not be completed. Please try again.'
    )
  }

  return data.data
}
