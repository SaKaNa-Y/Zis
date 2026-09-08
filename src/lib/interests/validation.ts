export const MAX_INTERESTS = 20
export const MAX_CHARACTERS = 200
export interface InterestStatement { id?: string, statement: string }

export class ProfileValidationError extends Error {}

export function validateProfile(input: unknown): InterestStatement[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_INTERESTS)
    throw new ProfileValidationError('Keep between 1 and 20 Interests. Add a replacement before removing your last Interest.')
  const ids = new Set<string>()
  return input.map((row: unknown) => {
    if (row === null || typeof row !== 'object' || !('statement' in row) || typeof row.statement !== 'string')
      throw new ProfileValidationError('Each Interest must be a statement.')
    const statement = row.statement.trim()
    if (statement.length === 0 || Array.from(statement).length > MAX_CHARACTERS)
      throw new ProfileValidationError('Each Interest must contain 1–200 characters after trimming spaces.')
    const id = 'id' in row ? row.id : undefined
    if (id !== undefined) {
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || ids.has(id.toLowerCase()))
        throw new ProfileValidationError('Reload your Interest Profile and try again.')
      ids.add(id.toLowerCase())
    }
    return { id: typeof id === 'string' ? id.toLowerCase() : undefined, statement }
  })
}

export function mayNotMatch(statement: string): boolean {
  return Array.from(statement).some(character => /\p{Letter}/u.test(character) && !/\p{Script=Latin}/u.test(character))
}
