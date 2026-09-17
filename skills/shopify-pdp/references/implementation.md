# Product-independent implementation notes

- Record design width, original image dimensions, reference page and section offset, missing text, font, weight, color, baseline, tracking, and rotation in the px manifest. Keep graph axis labels, side labels, footnotes, and rotated copy in the missing-text audit.
- Convert a design distance with `cqi = px / design_width * 100`, rounded to one decimal place at CSS output. Omit trailing .0 for integers. Preserve full-precision px source geometry; do not repeatedly round source coordinates. Account separately for differences between reference-image dimensions and supplied-background dimensions; avoid cumulative section-offset drift.
- PDF text span bounds are not CSS line boxes. Measure the selected browser font, then derive baseline offset from its ascent/descent and chosen line height. For a baseline at `(x, y)` rotated by angle θ, the line-box origin is `(x + baseline_offset * sin(θ), y - baseline_offset * cos(θ))`, before image-coordinate scaling.
- Preserve source transforms only as provenance. Never emit compensating scale/translate; preserve only genuine nonzero design rotation. Refit natural Pretendard text using font size, tracking, line breaks and coordinates. For outlined text, use finished-JPG ink bounds and visual comparison; do not substitute photographed text for HTML text.
- When replacing embedded faces with global Pretendard, translate named face weights (Light/Medium/SemiBold/Bold/ExtraBold) into numeric font-weight; an old 400 may have selected a bold font file. Fit both reference ink height and width without distorting glyphs, centering narrower natural text inside its original region as needed.
- Inherit site-wide Pretendard without font-family declarations, @font-face, font shorthand, font variables, loaders or base64 data. Measure using the selected product host's global font environment; wait for the actual glyphs and weights to load. CSS resets must retain inherited family. Standalone files do not load fonts; the verifier supplies the host environment only in the browser.
- Use `pdp-product`, `pdp-product--HANDLE`, and `pdp-product__ELEMENT` classes; scope by product and section modifiers. Use readable semantic element modifiers for geometry and keep source IDs in the layout only, never in output data-* attributes. Each section has a direct h2 and aria-labelledby, with `pdp-product__sr-only` for nonvisual headings.
- The generated fragment must render without layout JavaScript. A build-time browser can measure fonts and emit static CSS. Keep runtime dependencies out of the product description.
- The builder accepts an audited manifest and an optional filename-to-CDN-URL map. Reject missing entries and non-HTTPS CDN URLs. Relative original-image paths are suitable for local preview; label upload readiness truthfully.
- Discover an available browser or accept its executable path as input. Do not depend on a previous product's virtualenv, node_modules, or copied system libraries.
- Validate mobile and desktop widths, font/image loading, text bounds, and outside-theme typography. Compare standalone and Shopify geometry at identical content widths. A geometry pass is not a JPG pixel-match score.
- A temporary browser insertion verifies rendering only. Record the test URL, viewport sizes, screenshot paths and method, and distinguish it from a persisted Shopify product update.

## Delivery formatting

Follow the user’s description example: expanded structural CSS with two-space declarations, base/common rules first, a shared typography table, and numbered `/* section 01 */` groups in image order. HTML uses matching section comments and two-space nesting. Use the `pdp-product` BEM block with a product-specific modifier; never use the theme’s generic product block. Do not copy font-family declarations (including inherit), font loaders/embedding or centering transforms from examples. Resets must retain inherited family. Preserve audited geometry when reformatting existing PDPs.

Text `css_role` selects the semantic BEM element and a starting typography profile. Reference alignment and image-region constraints take precedence over that profile. Classify POINT labels before considering the source h2 tag; give section titles meaningful h2 semantics. The current product family has these starting profiles in `scripts/typography.mjs`; do not force their values onto an existing design when its bounds differ:

| Role | Size (cqi) | Weight | Line height | Tracking (cqi) |
| --- | ---: | ---: | ---: | ---: |
| point | 6 | 700 | 1 | 0 |
| title | 8 | 700 | 1.1 | -0.2 |
| title + typography_variant: compact | 6.5 | 700 | 1.1 | -0.1 |
| lead | 5.5 | 400 | 1.3 | -0.1 |
| body / notes | 3.2 | 400 | 1.4 | 0 |
| edge-label | 2.1 | 700 | 1 | 0 |
| footnote | 1.7 | 400 | 1.3 | 0 |

Use `emphasis: strong` (700) or `medium` (500) when the copy's hierarchy calls for it. Preserve colors; factor the most common color into each shared role and emit only actual local differences. Hero names, campaign lettering, graphs, numeric metrics and genuine rotated labels may use an audited semantic role with `typography_exception: {reason: "specific design constraint"}`; these retain the manifest size/weight/tracking. Do not make every difference an exception, or classify graph labels as footnotes solely by size. Record original font metrics in `source_typography` before migration. Original `size` and `tracking` remain source values; the builder resolves standard roles at build time. Unsupported roles without a reason fail the build. Do not generate numbered typography styles such as `text--style-01`.

A typography change is a visual change: remeasure baseline/ink bounds using the resolved line height, then check wrapping, adjacent text and fixed image regions at 320, 390, 768 and source width. Legacy `text_align: center` with `typography_anchor` describes an earlier render, which may already be wrong. For reference-sensitive edits, use `reference_box` from the original AI/JPG, with explicit alignment; never derive it from the fitted render. Override coordinates only after reviewing the image. Verification reports computed role mismatches, canvas ink bounds and overlap candidates; review candidates against screenshots, because intentional graphical overlap cannot be decided from rectangles alone. Standalone/host equivalence does not assert identity with the previous typography or reference JPG.

Section-local numbered modifiers distinguish geometry instances. Rules with at most five declarations may use one spaced line; larger rules stay expanded. Group identical typography declarations under shared role selectors. For exception roles, use the most frequent typography as the role default and override only differences. Natural text uses the common max-content width and automatic line height; emit explicit width/height only when a reviewed box requires them. Keep per-run rules for geometry, color differences and justified exceptions.

Optional section `text_groups` contain `{id, texts: [source run IDs], separator: "br" | "space" | ""}` and must be manually audited as one sentence or heading. The builder keeps each span’s reviewed position inside one semantic p/h2 wrapper; source IDs remain only in the layout, and audit resolves spans through their existing section/role classes; the wrapper does not establish a positioning container. For consecutive fragments on one baseline, `layout: "inline"` uses a positioned flex paragraph with static child spans and baseline alignment; `align: "center"` centers the combined text in the original anchor region. Keep spaces in the original runs and use an empty separator, avoiding invented gaps within split words. Use inline flow only after checking the shared baseline, color and available region. A heading group owns the section’s aria-labelledby target. Validate bounds against the nearest section, not a zero-height text-group wrapper.

Emit a CSS section comment only when that section has CSS rules; image-only sections retain their HTML section and accessible heading but have no empty CSS group. During cleanup, audit empty comment groups, unused/duplicate CSS rules, text-group separators, and source-run completeness; line count alone is not acceptance.

Every CSS `/* section NN */` comment must have exactly one blank line above and below it, including after a compact single-line rule. Normalize this spacing after formatting; never attach a section comment directly to the previous rule.

## Shared decorations and reset ownership

The descendant `all: unset` rule owns initial non-inherited values. Avoid repeated margin: 0, padding: 0, border: 0, background: none and box-shadow: none in descendant classes. The root still needs explicit spacing/border because the descendant reset does not cover it. Keep real overrides (e.g. hidden-heading negative margin, inline-group height overriding its base) and inherited typography controls.

For shapes within one section, share repeated background, border, border-radius and height values on the section’s `.pdp-product__shape` rule. Individual numbered modifiers specify position, width and actual exceptions. Do not unify unrelated regions merely because they happen to have the same color. Audit must catch repeated decoration properties even when the rest of each declaration block differs. Compare shape painting and geometry, not only text, after refactoring.

Shared typography omits line-height: 1 and letter-spacing: 0 already defined by the text base. Compact-title modifiers contain only properties different from the title role. Keep weight and color overrides explicit where their inheritance context requires them.

## Reference anchors and measured fits

`reference_box: {x, y, width, height, align: "left" | "center" | "right", source}` stores original ink bounds in section reference coordinates. Preserve these independently of legacy `ink` and `typography_anchor`, which may contain earlier font-fitting adjustments. The builder places the actual glyph ink at the specified edge or center and top, accounting for glyph bearings and CSS line height. Setting width on a text box does not position or resize the actual glyph ink.

`typography_fit: {size?, tracking?, weight?, reason}` records a measured deviation from the shared profile in source units. Use natural glyphs, size, tracking and line breaks, then round emitted cqi once. Reuse the role defaults and emit only the differences. Preserve original size/weight/tracking provenance. Do not enlarge or shrink all text in a role merely to simplify the CSS; this can move fixed callouts onto arrows and narrow left-aligned paragraphs into accidental indents.

For current artifacts with reference boxes, verify checks edge/center and top errors as well as width/height, independently of host equivalence. Width tolerance includes accumulated one-decimal tracking rounding; inspect full-size original/render pairs too. Known original stretched lettering may require an explicit, reviewed limitation while preserving the source center and natural Pretendard proportions. Do not silently treat any failed match as an exception.

Canvas setters do not accept all computed CSS values. Normalize computed letter-spacing normal to 0px for every run; otherwise a reused context retains the preceding text's tracking. Wait for the actual glyphs/weights before measuring. A typography mismatch check must also normalize normal to zero rather than compare NaN. Reference audit failure must fail verification, even if standalone/host rendering and previous/current pixels are identical.

The September 2026 alignment regression had three separate causes: earlier font fitting replaced left-aligned ink starts with per-line centered starts; fixed role sizes changed callout/paragraph widths without respecting original regions; checks compared the edited artifact to an already incorrect baseline instead of to the JPG. Keep alignment anchors, role-style reuse, and independent reference acceptance separate.

Measure the quantized font size and tracking that CSS will actually render, at the actual design-width scale, then convert metrics back to source coordinates for placement. Measuring full-precision source typography while emitting rounded cqi produces inconsistent centers and baselines. The reference position tolerance is two rendered pixels to account for cqi rounding and font hinting; glyph-height tolerance includes three source pixels plus two raster pixels for font hinting at fractional responsive sizes. These tolerances do not permit visible paragraph shifts.

Do not default an unfamiliar source font name to regular weight without inspecting the JPG. Source award headings exposed this mistake: preserve metadata, record the visually verified weight in typography_fit, and remeasure. When deriving bounds from JPG pixels, isolate superscript symbols from the neighboring heading; an asterisk inside a broad ROI can falsely increase its measured height. Compact role modifiers must remain overridable by section-specific measured fits; verify computed typography, not merely generated declarations.

Do not force condensed source lettering into identical width/height using so much negative tracking that word spaces disappear. Visually review native Pretendard proportions, preserve its reference anchor and readable spacing, and explicitly report any remaining font-proportion difference instead of claiming exact source identity.
