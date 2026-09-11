/**
 * The query-key convention every feature's api.ts follows (ARCHITECTURE.md
 * §2.5): `[resource]` for a list's base, `[resource, params]` for a
 * filtered/paginated list, `[resource, id]` for one row. A feature's
 * `invalidateQueries` targets `[resource]` so every variant (any page,
 * any filter) refetches after a write.
 *
 * Usage in a feature's api.ts:
 *   export const clientKeys = resourceKeys("clients");
 *   clientKeys.list({ page: 2, status: "active" }) // ["clients", { page, status }]
 *   clientKeys.detail(id)                          // ["clients", id]
 */
export function resourceKeys(resource: string) {
  return {
    all: [resource] as const,
    list: (params?: Record<string, unknown>) =>
      params ? ([resource, params] as const) : ([resource] as const),
    detail: (id: string) => [resource, id] as const,
  };
}
