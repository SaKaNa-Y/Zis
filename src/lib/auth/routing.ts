const PUBLIC_PATHS = new Set(['/login'])

/** Closed, exact allowlist. Every new product route is private by default. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname)
}
