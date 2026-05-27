# Journal Impact Factor — Zotero Plugin

## Project Purpose
A Zotero 7/9 plugin that surfaces 2024 Journal Impact Factor (JIF) data inline within the Zotero library:
- A custom **JIF 2024** column in the item list view
- A custom **info row** in the item detail pane showing JIF, 5-year JIF, quartile, and rank

## Data Source
- File: `impact_factors_cleaned.csv` (~20,449 journals, JCR 2024)
- Key fields used: `Journal Name`, `ISSN`, `eISSN`, `JIF 2024`, `5-Year JIF`, `JIF Without Self-Cites`, `JIF Quartile`, `JIF Rank`

## Data Protection Decision
**Goal:** Users should not be able to trivially export or scrape the full impact factor dataset.

**Approach:** The CSV is never shipped as a plain file. Instead:
1. `scripts/build_lookup.py` (Python 3, no dependencies) reads the CSV at build time
2. Builds a compact object with abbreviated keys, indexed three ways:
   - `i` = by ISSN (hyphen-stripped)
   - `e` = by eISSN (hyphen-stripped)
   - `n` = by normalized journal name (uppercase, non-alphanumeric stripped)
3. Serializes to JSON with abbreviated field names (`j`=JIF, `f`=5yr JIF, `q`=quartile, `r`=rank, `s`=JIF w/o self-cites)
4. XOR-encrypts the JSON bytes with a 32-byte key embedded in the JS source
5. Base64-encodes the result
6. Writes `content/data.js` — a self-contained JS module with the encoded blob + inline decoder

This means:
- No standalone JSON file exists in the .xpi
- The raw dataset is not human-readable
- Extraction requires reverse-engineering both the XOR key and the abbreviated schema
- Data only lives in memory at runtime; never written to disk or any Zotero field

## Matching Strategy (in priority order)
1. **ISSN match** — split ISSN field on whitespace, strip hyphens, look up each token in `i` (print ISSN) index only
2. **Normalized journal name** — uppercase + strip non-alphanumeric, look up in `n` index

Notes:
- Only `journalArticle` item types are matched; all other item types return empty
- The eISSN index (`e`) is built into the data but not currently used for matching — checking ISSN-field tokens against the eISSN index risks false matches between unrelated journals
- The ISSN field in Zotero may contain multiple space-separated values; all tokens are checked

## Plugin Structure
```
journal-impact-factor-zotero-plugin/
├── CLAUDE.md                       ← this file
├── impact_factors_cleaned.csv      ← source data (NOT shipped in .xpi)
├── scripts/
│   ├── build_lookup.py             ← build-time CSV → XOR-encoded JS blob (Python 3)
│   └── package.sh                  ← one-step: build data.js + zip .xpi
├── addon/
│   ├── manifest.json               ← Zotero WebExtension manifest
│   ├── bootstrap.js                ← plugin lifecycle entry point
│   ├── content/
│   │   ├── main.js                 ← lookup logic, column + info row registration
│   │   └── data.js                 ← generated: XOR-encoded impact factor blob
│   └── locale/
│       └── en-US/
│           └── addon.ftl           ← Fluent localization strings
└── build/
    └── journal-impact-factor.xpi   ← final packaged plugin
```

## Key Zotero APIs Used
- `Zotero.ItemTreeManager.registerColumn(opts)` — async; adds JIF column to the library list
- `Zotero.ItemPaneManager.registerInfoRow(opts)` — async; adds detail row in item pane
- `Zotero.initializationPromise` — awaited in `startup()` before touching any Zotero API
- `item.getField('publicationTitle')` — journal name
- `item.getField('ISSN')` — ISSN string (may be "XXXX-XXXX" or "XXXX-XXXX YYYY-YYYY")
- `item.itemType` — filter to `journalArticle` only

## Manifest
- `strict_min_version`: `"6.999"` (covers Zotero 7 betas and 9)
- `strict_max_version`: `"9.0.*"`
- No `icons` block (no icon assets exist)
- No `homepage_url`

## Build Process
```bash
# One-step build + package:
bash scripts/package.sh

# Or separately:
python3 scripts/build_lookup.py   # regenerate addon/content/data.js from CSV
cd addon && zip -r ../build/journal-impact-factor.xpi . -x "*.DS_Store"
```

Node.js is not required. Python 3 is used (pre-installed on macOS).

## Key Implementation Notes

### Async startup pattern
`bootstrap.js:startup()` is `async`. It loads scripts via `loadSubScript`, then waits for
`await Zotero.initializationPromise` before constructing `JIFPlugin`. `JIFPlugin.startup()`
is also `async` because `Zotero.ItemTreeManager.registerColumn()` returns a Promise — the
resolved key (not the Promise itself) must be stored so `unregisterColumn()` works on shutdown.

### loadSubScript vs Cu.import
Scripts are loaded with `Services.scriptloader.loadSubScript()`. **Never** call `Cu.unload()`
on these — that API is only for `Cu.import()` ES modules. Cleanup is done by nulling out the
globals (`globalThis.JIFData`, `globalThis.JIFPlugin`) in `shutdown()`.

### atob / TextDecoder
These Web APIs are not automatically in scope in Zotero's chrome bootstrap JS context.
`data.js` calls `Cu.importGlobalProperties(["atob", "TextDecoder"])` at the top of its IIFE
before any decoding. This line is part of the template in `build_lookup.py` and is regenerated
on every build.

### Cache lifecycle
`data.js` exposes `JIFData.clear()` which sets the private `_cache` closure variable to `null`.
`JIFPlugin.shutdown()` calls this to release the ~5 MB decoded lookup from memory. The closure
variable is not accessible any other way — setting a property on `JIFData` would be a no-op.

### XOR key
The 32-byte key is defined once in `build_lookup.py` (as `KEY`) and is embedded verbatim into
the generated `data.js` as `_K`. If the key is changed, `data.js` must be regenerated via
`python3 scripts/build_lookup.py` or `bash scripts/package.sh`.

### CSV column validation
`build_lookup.py` validates that all required column names are present in the CSV header before
processing any rows. If a column is missing (e.g., the CSV is updated with renamed headers), the
script exits with a clear error rather than silently producing an empty index.

## Current State
- [x] `scripts/build_lookup.py` — implemented, runs successfully
- [x] `scripts/package.sh` — one-step build + package
- [x] `addon/manifest.json` — `strict_max_version "9.0.*"`, no icons, no homepage_url
- [x] `addon/bootstrap.js` — async startup, `initializationPromise` guard, no `Cu.unload()`
- [x] `addon/content/main.js` — async `registerColumn`, correct cache clear, ISSN-only matching
- [x] `addon/content/data.js` — generated (18178 ISSNs, 19311 eISSNs, 19726 names; 1.9 MB compressed)
- [x] `addon/locale/en-US/addon.ftl` — `jif-row-label` only
- [x] `build/journal-impact-factor.xpi` — 1.9 MB, ready to install

## Installing the Plugin
1. Open Zotero
2. Go to Tools → Add-ons
3. Click the gear icon → "Install Add-on From File…"
4. Select `build/journal-impact-factor.xpi`
5. Restart Zotero
6. Right-click library column headers → enable "JIF 2024" column

## Open Questions / Future Work
- Verify `Zotero.ItemPaneManager.registerInfoRow` signature on an actual Zotero 9 build — the API stabilized late in Zotero 7
- The eISSN index is built but unused; a future improvement could check `item.getField('eISSN')` if Zotero exposes that field separately
- Consider a preference pane to toggle column visibility or select which JIF year to display
- Consider a right-click context menu action: "Look up Impact Factor" for manual per-item refresh
