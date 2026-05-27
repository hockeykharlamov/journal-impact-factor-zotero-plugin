#!/usr/bin/env python3
"""
Build script: impact_factors_cleaned.csv -> addon/content/data.js

Produces a XOR-encrypted, base64-encoded JS module so the raw dataset
is not extractable by simply unzipping the .xpi.

Run: python3 scripts/build_lookup.py
"""

import csv
import json
import base64
import os
import re
import sys

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'impact_factors_cleaned.csv')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'addon', 'content', 'data.js')

# XOR key — 32 bytes mirrored in data.js decoder.
# If you change this, you MUST regenerate data.js.
KEY = [
    0x4a, 0x1f, 0x8c, 0x37, 0xe2, 0x5b, 0x90, 0xd4,
    0x6e, 0xa3, 0x17, 0xfc, 0x28, 0x74, 0xbb, 0x09,
    0xd1, 0x53, 0x86, 0x2e, 0x41, 0x9f, 0xc7, 0x3a,
    0x65, 0xf8, 0x0b, 0x4d, 0x92, 0xe6, 0x1c, 0x78,
]

REQUIRED_COLUMNS = {
    'Journal Name', 'ISSN', 'eISSN',
    'JIF 2024', '5-Year JIF', 'JIF Without Self-Cites',
    'JIF Quartile', 'JIF Rank',
}


def normalize_name(name: str) -> str:
    return re.sub(r'[^A-Z0-9]', '', name.upper())


def strip_hyphens(issn: str) -> str:
    return issn.replace('-', '').strip()


def parse_float(val: str):
    try:
        return round(float(val), 1)
    except (ValueError, TypeError):
        return None


def build_indexes(csv_path: str):
    by_issn = {}
    by_eissn = {}
    by_name = {}

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)

        # Validate that all expected columns are present before processing rows.
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            print(f"ERROR: CSV is missing required columns: {sorted(missing)}", file=sys.stderr)
            print(f"  Found columns: {reader.fieldnames}", file=sys.stderr)
            sys.exit(1)

        for row in reader:
            name     = (row.get('Journal Name') or '').strip()
            issn     = (row.get('ISSN') or '').strip()
            eissn    = (row.get('eISSN') or '').strip()
            jif      = parse_float(row.get('JIF 2024', ''))
            jif5     = parse_float(row.get('5-Year JIF', ''))
            jif_self = parse_float(row.get('JIF Without Self-Cites', ''))
            quartile = (row.get('JIF Quartile') or '').strip()
            rank     = (row.get('JIF Rank') or '').strip()

            if not name or jif is None:
                continue

            entry = {'j': jif, 'f': jif5, 's': jif_self, 'q': quartile, 'r': rank}
            # Remove None/empty/N/A values to keep JSON compact and avoid
            # showing "N/A" strings verbatim in the Zotero info row.
            entry = {k: v for k, v in entry.items()
                     if v is not None and v != '' and v != 'N/A'}

            # ISSN index (print ISSNs only).
            if issn and issn != 'N/A':
                for token in issn.split():
                    clean = strip_hyphens(token)
                    if len(clean) == 8:
                        by_issn.setdefault(clean, entry.copy())

            # eISSN index (electronic ISSNs only).
            if eissn and eissn != 'N/A':
                for token in eissn.split():
                    clean = strip_hyphens(token)
                    if len(clean) == 8:
                        by_eissn.setdefault(clean, entry.copy())

            # Normalized name index (first occurrence wins).
            norm = normalize_name(name)
            if norm:
                by_name.setdefault(norm, entry.copy())

    return {'i': by_issn, 'e': by_eissn, 'n': by_name}


def xor_encode(data: bytes, key: list) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def main():
    print('Reading CSV...')
    indexes = build_indexes(CSV_PATH)

    print(f"Indexed: {len(indexes['i'])} ISSNs, "
          f"{len(indexes['e'])} eISSNs, "
          f"{len(indexes['n'])} names")

    print('Encoding...')
    raw = json.dumps(indexes, separators=(',', ':')).encode('utf-8')
    encoded = xor_encode(raw, KEY)
    b64 = base64.b64encode(encoded).decode('ascii')

    # Split into 120-char chunks to avoid a single enormous string literal.
    CHUNK = 120
    chunks = [json.dumps(b64[i:i+CHUNK]) for i in range(0, len(b64), CHUNK)]
    chunk_lines = ',\n    '.join(chunks)

    key_literal = json.dumps(KEY)

    output = f"""// AUTO-GENERATED — do not edit by hand. Run: python3 scripts/build_lookup.py
// Impact factor lookup table — XOR-encoded to prevent trivial dataset extraction.
/* eslint-disable */
(function() {{
  "use strict";

  // atob and TextDecoder are Web APIs not automatically in scope in Zotero's
  // chrome bootstrap JS context (SpiderMonkey). Import them explicitly.
  if (typeof Cu !== "undefined") {{
    Cu.importGlobalProperties(["atob", "TextDecoder"]);
  }}

  const _K = {key_literal};
  const _D = [
    {chunk_lines}
  ].join('');

  function _decode(b64, key) {{
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {{
      out[i] = bin.charCodeAt(i) ^ key[i % key.length];
    }}
    return new TextDecoder().decode(out);
  }}

  let _cache = null;

  function getLookup() {{
    if (!_cache) _cache = JSON.parse(_decode(_D, _K));
    return _cache;
  }}

  // Exposed so shutdown() in main.js can release the decoded cache from memory.
  function clear() {{
    _cache = null;
  }}

  const JIFData = {{ getLookup, clear }};
  if (typeof globalThis !== "undefined") globalThis.JIFData = JIFData;
  if (typeof window !== "undefined") window.JIFData = JIFData;
}})();
"""

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(output)

    size_kb = round(len(output) / 1024)
    print(f'Written: addon/content/data.js ({size_kb} KB)')
    print('Done.')


if __name__ == '__main__':
    main()
