import type { components } from "@openapi/schema";

export type CurrentUser = components["schemas"]["CurrentUser"];
export type CurrentSession = components["schemas"]["CurrentSession"];
export type Grant = components["schemas"]["Grant"];
export type Scope = Grant["scopes"][number];
