"use strict";

(function() {

  const PLUGIN_ID = "journal-impact-factor@zotero.org";

  // ── Lookup helpers ──────────────────────────────────────────────────────────

  function normalizeName(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function stripHyphens(s) {
    return (s || '').replace(/-/g, '').trim();
  }

  function findEntry(item) {
    if (!item || item.itemType !== 'journalArticle') return null;
    if (!globalThis.JIFData) return null;

    const lookup = globalThis.JIFData.getLookup();

    // 1. Try each ISSN token against the ISSN index only.
    //    The ISSN field in Zotero may contain multiple space-separated values
    //    (e.g. "0007-9235 1542-4863"), but they should only be matched against
    //    the print-ISSN index (lookup.i). Checking against the eISSN index here
    //    would risk false matches between unrelated journals.
    const issnRaw = item.getField('ISSN') || '';
    for (const token of issnRaw.split(/\s+/)) {
      const clean = stripHyphens(token);
      if (clean.length === 8 && lookup.i[clean]) return lookup.i[clean];
    }

    // 2. Normalized journal name fallback.
    const title = item.getField('publicationTitle') || '';
    if (title) {
      const norm = normalizeName(title);
      if (norm && lookup.n[norm]) return lookup.n[norm];
    }

    return null;
  }

  function formatJIF(entry) {
    if (!entry) return '';
    return entry.j != null ? String(entry.j) : '';
  }

  function formatDetail(entry) {
    if (!entry) return '';
    const parts = [];
    if (entry.j != null) parts.push(`JIF: ${entry.j}`);
    if (entry.f != null) parts.push(`5-yr: ${entry.f}`);
    if (entry.q)          parts.push(entry.q);
    if (entry.r)          parts.push(`Rank: ${entry.r}`);
    return parts.join('  |  ');
  }

  // ── Plugin class ────────────────────────────────────────────────────────────

  class JIFPlugin {
    constructor(rootURI) {
      this._rootURI = rootURI;
      this._columnKey = null;
      this._rowKey = null;
    }

    async startup() {
      await this._registerColumn();
      await this._registerInfoRow();
    }

    async shutdown() {
      if (this._columnKey) {
        try { await Zotero.ItemTreeManager.unregisterColumn(this._columnKey); } catch (e) {}
        this._columnKey = null;
      }
      if (this._rowKey) {
        try { await Zotero.ItemPaneManager.unregisterInfoRow(this._rowKey); } catch (e) {}
        this._rowKey = null;
      }
      // Clear the decoded in-memory cache via the exported clear() method.
      if (globalThis.JIFData && typeof globalThis.JIFData.clear === 'function') {
        globalThis.JIFData.clear();
      }
    }

    async _registerColumn() {
      try {
        // registerColumn() is async and must be awaited to get the actual key
        // (not a Promise) that unregisterColumn() requires.
        this._columnKey = await Zotero.ItemTreeManager.registerColumn({
          dataKey: 'jif2024',
          label: 'JIF 2024',
          pluginID: PLUGIN_ID,
          dataProvider: (item, _dataKey) => formatJIF(findEntry(item)),
        });
      } catch (e) {
        Zotero.logError('[JIF] registerColumn failed: ' + e);
      }
    }

    async _registerInfoRow() {
      try {
        this._rowKey = await Zotero.ItemPaneManager.registerInfoRow({
          rowID: 'jif-impact-factor',
          pluginID: PLUGIN_ID,
          label: { l10nID: 'jif-row-label' },
          onGetData({ item }) {
            return formatDetail(findEntry(item));
          },
        });
      } catch (e) {
        // registerInfoRow may not exist in all Zotero 7.x builds — degrade gracefully.
        Zotero.logError('[JIF] registerInfoRow failed (may not be supported): ' + e);
      }
    }
  }

  globalThis.JIFPlugin = JIFPlugin;

})();
