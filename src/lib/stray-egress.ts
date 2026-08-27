// DELIBERATE VIOLATION, removed in the commit after this one. #67 asks for the
// egress rule to be proven rather than described: a check that has never failed
// has not been verified.
export async function strayFromSrc(url: string): Promise<Response> {
  return fetch(url)
}
