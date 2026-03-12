# OSDS Extension — Development Notes for Claude

## @base IRI Resolution in Turtle/N3 Parsing

### Expected Behavior

When a Turtle document declares `@base` with an IRI ending in `#`:

```turtle
@base <https://github.com/wu-yc/LabClaw/tree/main/skills#> .
<Skill> a <Thing> .
```

`<Skill>` **must** expand to `https://github.com/wu-yc/LabClaw/tree/main/skills#Skill`
(simple concatenation of base + local name).

### Root Cause (N3.js Bug)

N3.js `_resolveRelativeIRI` computes `_basePath` by stripping everything after the last `/`:

```
"https://…/skills#"  →  _basePath = "https://…/main/"
```

So `<Skill>` falls through to the `default` case:
`_basePath + iri` = `"https://…/main/Skill"` ✗

This affects any `@base` IRI whose path component ends with a fragment indicator (`#`).

### Fix (in `src/handlers.js`)

`_preprocessHashBase(text)` is a preprocessing function applied to Turtle text **before**
N3.js parsing (in `Handle_Turtle._parse_1`). It:

1. Finds `@base <...#>` declarations (where the base IRI ends with `#`)
2. For each governed text segment, expands bare `<LocalName>` relative IRIs to
   `<baseIRI + LocalName>` absolute form
3. Leaves untouched: empty IRIs `<>`, fragment refs `<#...>`, path-relative `</...>`,
   query-relative `<?...>`, and already-absolute IRIs

The preprocessing runs before the N3.js parser sees the text, so N3.js always receives
already-resolved absolute IRIs and never invokes the broken `_basePath` logic for these cases.

## Release / Build Workflow

1. Bump version in all three manifests (find/replace `"version": "X.Y.Z"`):
   - `src/manifest.json` (Chrome)
   - `src/manifest.json.ff` (Firefox)
   - `src/manifest.json.sf` (Safari)

2. Run the build script from the project root:
   ```
   bash prepare_chrome.sh
   ```
   This populates the `OSDS_Chrome/` directory.

3. Package the zip **from the project root** so the archive expands to `OSDS_Chrome/`:
   ```
   zip -r OSDS_Chrome_4_0_XX.zip OSDS_Chrome/
   ```
   **Do NOT** `cd OSDS_Chrome && zip -r ../... .` — that produces a flat archive
   without the `OSDS_Chrome/` top-level directory.

---

### Affected File

`src/handlers.js` — `_preprocessHashBase()` function (module-level, above `class Handle_Turtle`)
and call site in `Handle_Turtle._parse_1()` after `ns_pref` prepend.
