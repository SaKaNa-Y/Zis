import 'server-only'

interface VerifiedReader {
  userId: string
}

export interface ReaderSignalActionDependencies {
  markRead: (userId: string, signalId: string) => Promise<void>
  revalidate: (path: string, type?: 'page') => void
  save: (userId: string, signalId: string) => Promise<void>
  verifySession: () => Promise<VerifiedReader>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function signalIdFrom(formData: FormData): string {
  const value = formData.get('signalId')
  if (typeof value !== 'string' || !UUID.test(value))
    throw new Error('Reader action requires a valid Signal id')
  return value
}

export function createReaderSignalActions(dependencies: ReaderSignalActionDependencies) {
  const action = (
    mutate: (userId: string, signalId: string) => Promise<void>,
  ): ((formData: FormData) => Promise<void>) => {
    return async (formData) => {
      const signalId = signalIdFrom(formData)
      const { userId } = await dependencies.verifySession()
      await mutate(userId, signalId)
      dependencies.revalidate('/')
      dependencies.revalidate('/earlier/[date]', 'page')
    }
  }

  return {
    markRead: action(dependencies.markRead),
    save: action(dependencies.save),
  }
}
