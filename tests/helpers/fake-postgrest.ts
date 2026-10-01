export type Result = { data: unknown; error: { message: string } | null };

export const EMPTY_PAGE: Result = { data: [], error: null };

/**
 * Every chain link every `fakeDb` in this file records itself into, as
 * `<label>.<method>(<args>)`. It lives here rather than in a test file's
 * `vi.hoisted` boundary because a hoisted factory runs before imports, so it
 * cannot reference `fakeDb`; tests truncate it in `afterEach`.
 */
export const calls: string[] = [];

/**
 * Chainable, awaitable fake for the PostgREST query builder: `from()` returns a
 * chain where every link method records itself, and awaiting the chain consumes
 * the next canned result. Only the chain is thenable — a thenable `db` root
 * would be unwrapped by the `await` on `createServerSupabaseClient()`.
 */
export function fakeDb(label: string, results: Result[]) {
  let step = 0;
  const chain: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (prop === "then") {
        return (resolve: (value: Result) => void) => resolve(results[step++]);
      }
      return (...args: unknown[]) => {
        calls.push(`${label}.${prop}(${args.map(String).join(",")})`);
        return chain;
      };
    },
  });
  return {
    from(table: string) {
      calls.push(`${label}.from(${table})`);
      return chain;
    },
  };
}
