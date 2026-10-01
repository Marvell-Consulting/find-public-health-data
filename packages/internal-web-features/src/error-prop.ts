/** `error` for the NotGovUK controls whose types take one only when there is one. */
export function errorProp(error: string | undefined): { error?: string } {
  return error === undefined ? {} : { error };
}
