# Journal Impact Factor — Zotero Plugin

Surfaces **2024 Journal Impact Factor (JIF)** data directly inside your Zotero library:

- A sortable **JIF 2024** column in the item list
- An **Impact Factor** value in the item detail pane (JIF + quartile, e.g. `10.4 (Q1)`)

Data covers ~20,000 journals from the 2024 Journal Citation Reports.

---

## Download

### ⬇️ [Download the latest plugin (.xpi)](https://github.com/hockeykharlamov/journal-impact-factor-zotero-plugin/releases/latest/download/journal-impact-factor.xpi)

Click the link above to download `journal-impact-factor.xpi` to your computer. You can
also browse all versions on the [Releases page](https://github.com/hockeykharlamov/journal-impact-factor-zotero-plugin/releases).

> **Tip:** If your browser opens the file as text instead of downloading it, right-click the link and choose **"Save Link As…"**.

---

## Install

1. Open **Zotero** (version 7 or later, including Zotero 9).
2. In the menu bar, go to **Tools → Plugins**.
3. Click the **gear icon** (⚙️) in the top-right of the Plugins window.
4. Choose **"Install Plugin From File…"**.
5. Select the `journal-impact-factor.xpi` file you downloaded.
6. **Restart Zotero** when prompted.

---

## Use

### Show the JIF column in your library list

1. Right-click any column header (e.g. **Title** or **Creator**) at the top of the item list.
2. In the menu that appears, check **"JIF 2024"**.
3. A new column appears showing each journal article's impact factor. Click the header to sort by it.

### See impact factor details

Click any **journal article** in your library. The right-hand detail pane shows an
**Impact Factor** entry with the value and quartile, e.g. `Impact Factor: 10.4 (Q1)`.

> Impact factors only appear for items of type **Journal Article**. Books, conference
> papers, and other item types are left blank.

---

## How matching works

Each item is matched to a journal in this order:

1. **ISSN** — the item's ISSN field is matched against the dataset.
2. **Journal name** — if no ISSN match, the publication title is matched (case- and
   punctuation-insensitive).

If neither matches, no impact factor is shown for that item.

---

## Updating

When a new version is released, Zotero will offer to update the plugin automatically.
You can also check manually via **Tools → Plugins → gear icon → Check for Updates**.

---

## Troubleshooting

**"This plugin could not be installed. It may be incompatible with this version of Zotero."**
Make sure you're running Zotero 7 or later. This plugin does not work with Zotero 6.

**The JIF column is missing.**
The column is hidden by default. Right-click a column header and enable **"JIF 2024"**
(see [Use](#use) above).

**A journal article shows no impact factor.**
The journal may not be in the 2024 dataset, or its ISSN/name in Zotero doesn't match
the dataset. This is expected for newer, regional, or non-indexed journals.

---

## Privacy

Once every 24 hours, the plugin sends an anonymous heartbeat to a server we run
so we can count how many people use the plugin. The request includes only the
plugin version. Your IP address is visible to the server as part of normal HTTP
routing; we do not store any personally identifying information about your
library, your items, or your queries.

The same server also serves the auto-update manifest that Zotero checks
periodically — this is standard behavior for any Zotero plugin that supports
updates.

To disable both, you can uninstall the plugin from **Tools → Plugins**.
