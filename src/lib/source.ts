import { loader } from "fumadocs-core/source";

/**
 * Fumadocs docs source.
 *
 * This checkout ships no MDX collection — there is no `source.config.ts` and no
 * `content/` directory, so the `fumadocs-mdx` plugin never emits `.source/server`
 * on disk. Importing that generated module (as this file used to) makes every
 * /docs route fail to compile with:
 *
 *   Module not found: Can't resolve '../../.source/server'
 *
 * /docs/api-explorer is independent of this module; /docs, its layout and the
 * docs search endpoint only need the standard loader API (pageTree / getPages /
 * getPage), so build the source from an explicitly empty file list. The site
 * then renders with an empty-but-valid navigable tree instead of a build error.
 *
 * To restore real docs pages: add a `source.config.ts` declaring the `docs`
 * collection plus `content/` MDX files, then re-import
 * `{ docs } from "../../.source/server"` and feed `docs.toFumadocsSource()`.
 */
const docsSource = {
  files: [],
  languages: [],
};

export const source = loader({
  baseUrl: "/docs",
  source: docsSource,
});
