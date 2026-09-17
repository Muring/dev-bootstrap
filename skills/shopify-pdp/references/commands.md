# Executable toolkit

The global skill owns `pdp`, `scripts/design.py`, `scripts/build.mjs`, `scripts/verify.mjs`, `scripts/runtime.mjs`, `scripts/typography.mjs`, `scripts/audit.mjs`, `scripts/host.mjs`, `scripts/library.py`, and `scripts/setup.sh`. Find them relative to SKILL.md, not through an old product path.

Dependencies live in `${PDP_RUNTIME:-${XDG_CACHE_HOME:-$HOME/.cache}/shopify-pdp}`. `PDP_CHROME` can select an existing browser. Setup needs Node/npm and uv. It installs a separate Python environment, pinned Playwright and Chromium. On minimal Debian/Ubuntu hosts it supplies common missing browser libraries inside its cache without sudo. If platform dependencies remain unavailable, report the actual launch failure rather than reaching into another product's environment.

```sh
pdp setup
pdp library-init --root /library
pdp index --root /library
pdp inspect --source /source/product --project /output/product
pdp init --source /source/product --project /output/product --name 'Product title' --namespace pdp-product--product-name --width 1000
pdp register --project /output/product --mapping /output/product/reference-map.json
pdp build --project /output/product
pdp audit --project /output/product
pdp verify --project /output/product
pdp verify --project /output/product --url 'http://localhost:PORT/products/HANDLE?view=description'
pdp compare --project /output/product --mapping /output/product/reference-map.json
pdp serve --project /output/product
pdp build --project /output/product --cdn-map /output/product/cdn-map.json --output description.shopify.html
```

Here `pdp` means the bundled executable (or its installed user-bin wrapper). Every subcommand has `--help`. `serve` chooses a free loopback port, or accepts `--port`. `verify` starts and closes its own temporary local server: it needs no existing preview server, fixed port, or theme repository. Its optional Shopify selector defaults to `[id$="__pdp-description"] .section-gen-base__inner`; pass `--selector` for another description container.

`inspect` reads text, geometry, traces and font metadata from every AI/PDF in the supplied directory. It records source images and hashes; it never extracts AI photos. `init` links the original images directory using a relative symlink and writes an **unreviewed** manifest. Inside a library’s `products/SLUG/`, it also records library/source paths in `project.json` and refreshes the root product index. It will not overwrite an existing layout. The initial image ordering must be reviewed, not assumed to be the final section order.

`fonts`, `subset`, and `share-fonts` are disabled legacy commands that explain the new font policy. They are not part of the current global-Pretendard workflow and must not add font dependencies to current manifests. Original font metadata may be retained as `source_font` provenance only.

`build --url URL [--selector CSS]` measures the site's global Pretendard, using `project.json.verification_url` or the layout URL when --url is absent. The URL must belong to the selected product. No fonts or host styles are saved in description.html or preview.html. Verification applies the site's global font stylesheet in the browser only. Opening preview.html directly without a host uses the browser's default font and is not a Pretendard validation.

`register` takes an explicit mapping; paths are resolved relative to the mapping file. It writes candidate alignment data to `_work/registration.json`, not over the reviewed manifest. `--window` adjusts the vertical search range. Review results against actual imagery.

```json
{"pages":[{"number":1,"reference":"/source/product/final-1.jpg","images":["01.jpg","02.jpg"]}]}
```

The finalized `layout.px.json` uses this structure:

```json
{
  "name":"Product",
  "namespace":"pdp-product--product",
  "design_width":1000,
  "reviewed":true,
  "sections":[{
    "image":"01.jpg","page":1,"origin_y":0,"scale":1,
    "width":1000,"height":1500,"alt":"Copy already printed in image","label":"Product benefit",
    "shapes":[],
    "texts":[{"id":"t001","text":"Missing copy","x":100,"y":200,"size":50,
      "weight":400,"color":"#000000","tag":"h2","css_role":"title","source":"AI text"}]
  }]
}
```

Text `y` is the baseline relative to the section origin; `ink: [left, top, width, height]` provides outlined-copy reference bounds. `size` and `tracking` retain source typography and control justified exceptions; shared roles resolve current rendering values; `width` is historical source advance, never a scale target. Optional `box_width`/`box_height` set explicit CSS boxes without stretching glyphs. `rotation` is a genuine nonzero design rotation. `source_font` is provenance, not a resource alias. Required `css_role` selects semantic BEM and a starting typography profile. Optional `reference_box` preserves original ink bounds and explicit edge/center alignment; `typography_fit` records measured size/tracking/weight differences with a reason. Reference geometry takes priority over the shared scale. Use `typography_variant: compact` for compact titles, `emphasis` for weight, or a reasoned `typography_exception` for fixed graphic treatments; see implementation.md. Typography changes require remeasurement and visual review. Output CSS shares repeated typography and uses numbered section comments. Structural rules are expanded; short typography/position overrides use a spaced line. Audited section text_groups combine source-run IDs into semantic paragraphs/headings with preserved absolute positions by default, or audited inline flow (see implementation.md). All cqi values are rounded to at most one decimal at output. Every section without a visible h2 must have an audited `label` for its hidden heading. The namespace is a `pdp-product--handle` BEM modifier.

No command guesses missing copy. Rebuild after copy/geometry changes, then visually compare at source and mobile widths and verify the selected Shopify description page. Current builds need original backgrounds, a reviewed manifest, and a global Pretendard host; they do not need product font files or subsets.

For an explicitly approved missing gradient region immediately before an image, a section may carry `lead_in: {height, background, source}`. `height` is in reference pixels and `background` is an audited `linear-gradient(...)`. The builder reserves this region with cqi padding and paints the gradient behind it; original image dimensions and bytes remain intact. Set `origin_y` to the beginning of the combined region, preserve the actual image origin as `image_reference_origin_y`, and offset all image-region text/shapes by the lead-in height. The comparison command includes this height in the reference crop. This is not permission to invent missing source content.

## Library storage and existing-product migration

Keep originals in `/library/sources/HANDLE/` unchanged and generated results in `products/HANDLE/`. Product images and comparison references link original files. Preserve existing CDN maps and source paths. Current builds do not register fonts in shared storage. Historical font files may remain when preserved revisions or analysis depend on them; never blindly delete the shared font store.

`build` automatically uses `cdn-map.json` unless `--local-images` is supplied. `--cdn-map FILE` selects another map. Fragment images retain CDN paths; preview uses original local backgrounds. Run `index` after verification and serve the library root for its overview.

`audit` runs offline browser HTML/CSS checks for empty section comments/rules, unused selectors, duplicate declaration blocks, source-text completeness, group membership, heading references, BEM, font policy and cqi precision. It writes validation/structure-audit.json. `verify` includes this audit before rendering.

## Compact and section verification

`audit --summary` and `verify --summary` emit a bounded JSON summary plus the detailed report path. `verify --sections 2,5 --summary` keeps original section numbers and checks geometry only for selected text; document structure, policy, images and global overflow are still checked. Screenshots are limited to selected sections at the design width. Partial reports/screenshots live under `validation/partial/2-5/` and never overwrite `validation/report.json`. Shared changes and final delivery require a full run. Reports include `scope`, sections, verification time and an input hash so old full results cannot be mistaken for current proof.
