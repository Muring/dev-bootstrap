# Product selection at invocation

Examples (chat input, not shell commands):

```text
$shopify-pdp
$shopify-pdp og-serum
$shopify-pdp perfect-serum-hydrating 기존 PDP 수정: 그래프 라벨 위치 조정
$shopify-pdp 제품 og-serum 원본 /library/sources/og-serum 출력 /library/products/og-serum 검증URL https://store/products/handle?view=description
```

## Resolve the library

Explicit source/output/library paths supplied by the user take precedence. Otherwise inspect the active project: its `pdp/library.json`, a current/ancestor `library.json`, or the library recorded in a product’s `project.json`. In a theme Git worktree, `git rev-parse --git-common-dir` can locate the main `theme/` repository; inspect its sibling `pdp/` for `library.json`. Use paths actually found, not a hardcoded home directory or a product from another project. If no library or multiple plausible libraries are found, ask which library to use before selecting a product. Do not initialize a new library merely to resolve ambiguity.

## Choose the product

- Accept the product handle/name or explicit source/output path supplied in the current request. Exact source-directory handles are preferred. If a name has multiple matches or no match, show available handles and ask; never silently substitute a similar product.
- An explicit request to revise all existing PDPs selects all current products; do not ask the user to choose one.
- With no product specified in this invocation, enumerate immediate product directories under `sources/` and ask the user to choose, even if a previous turn worked on a particular product. Show each handle and whether `products/HANDLE/` has existing output. Do not hardcode the list, choose the first entry, or begin writes while waiting. If there are no source products, ask for the source location.
- Unless the user supplies other paths, resolve the selected product to `sources/HANDLE/` and `products/HANDLE/` in the same library. Inspect the source’s actual background directory; do not require renaming an existing image directory.

## Existing result and work intent

Inspect the selected output directory before creating anything. If it contains a layout, description, or other work and the user has not specified intent, ask whether to modify/continue the existing PDP or create a new version. If the user already explicitly requested modification, continuation, or a new version, honor that without asking again. Ask for the desired edits if a modification request contains none.

Modify/continue in the existing product directory. For a requested new version, preserve the previous product-specific files in a dated revision backup before changes; retain shared image/font references instead of duplicating originals or runtime dependencies. Do not erase or overwrite prior work while intent is unresolved. A source-only product with an empty/nonexistent output directory can proceed as new work.

## Verification URL

Use the URL supplied in the request or already explicitly established for the selected product. An existing selected-product configuration or validation report can supply a previous URL: check that it is still reachable and belongs to that product. Never invent a Shopify domain or infer a storefront handle from a source folder name.

If the product’s verification URL is missing or no longer usable, ask for it when preparing Shopify validation. Continue independent source inspection, copy/heading audits and layout preparation while awaiting the answer. Final build and font-accurate checks need the global font host. Do not claim Shopify validation passed until the correct product page has actually been checked. Preserve other URL query parameters when selecting `view=description`.

Once product and work intent are resolved, state the selected source/output paths and whether this is new work or modification, then follow the main design workflow. Product selection does not authorize uploading images or saving Shopify product/theme changes.
