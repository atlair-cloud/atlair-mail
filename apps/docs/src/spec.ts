type Operation = { tags?: string[]; security?: Record<string, string[]>[] };

export type OpenApiDocument = {
  info: Record<string, unknown>;
  paths: Record<string, Record<string, Operation>>;
  tags?: { name: string }[];
  security?: Record<string, string[]>[];
  components?: { securitySchemes?: Record<string, unknown>; [key: string]: unknown };
  [key: string]: unknown;
};

const publicPrefix = "/service/web/";
const hiddenPrefixes = ["/service/web/organizations"];

const isPublic = (path: string) => path.startsWith(publicPrefix) && !hiddenPrefixes.some((prefix) => path.startsWith(prefix));

const operations = (paths: OpenApiDocument["paths"]) =>
  Object.values(paths).flatMap((item) => Object.values(item).filter((value): value is Operation => typeof value === "object" && value !== null));

export function publicSpec(spec: OpenApiDocument, server: string, info: Record<string, unknown>): OpenApiDocument {
  const basePath = new URL(server).pathname.replace(/\/$/, "");
  const paths = Object.fromEntries(
    Object.entries(spec.paths)
      .filter(([path]) => path.startsWith(`${basePath}/`))
      .map(([path, item]) => [path.slice(basePath.length).replace(/(.)\/$/, "$1"), item] as const)
      .filter(([path]) => isPublic(path)),
  );

  const kept = operations(paths);
  const usedTags = new Set(kept.flatMap((operation) => operation.tags ?? []));
  const usedSchemes = new Set([...(spec.security ?? []), ...kept.flatMap((operation) => operation.security ?? [])].flatMap(Object.keys));
  const securitySchemes = Object.fromEntries(Object.entries(spec.components?.securitySchemes ?? {}).filter(([name]) => usedSchemes.has(name)));

  return {
    ...spec,
    info: { ...spec.info, ...info },
    servers: [{ url: server }],
    paths,
    ...(spec.tags ? { tags: spec.tags.filter((tag) => usedTags.has(tag.name)) } : {}),
    components: { ...spec.components, securitySchemes },
  };
}
