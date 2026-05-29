"use strict";

var JIF;
var _startupPromise = null;
var _shutdownRequested = false;

const PING_URL = "https://jif-update.evanowbaxter.workers.dev/ping";
const PING_PREF = "extensions.journal-impact-factor.lastPing";
const PING_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Fire-and-forget: once per 24h per install, POST a heartbeat so we can count
// active installs. Wrapped to never throw and never block startup.
function maybePingHome(version) {
  try {
    const last = Number(Zotero.Prefs.get(PING_PREF, true) || 0);
    const now = Date.now();
    if (now - last < PING_INTERVAL_MS) return;
    Zotero.Prefs.set(PING_PREF, String(now), true);
    fetch(PING_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ v: version }),
    }).catch(() => {});
  } catch (e) {}
}

// startup is async: we must wait for Zotero to finish initializing before
// touching any Zotero.* API (ItemTreeManager, ItemPaneManager, etc.).
async function startup({ id, version, rootURI }) {
  _shutdownRequested = false;
  _startupPromise = (async () => {
    // Load scripts only after Zotero is initialized so that Cu.importGlobalProperties
    // and all Zotero.* APIs are available when the scripts execute.
    await Zotero.initializationPromise;

    Services.scriptloader.loadSubScript(rootURI + "content/data.js");
    Services.scriptloader.loadSubScript(rootURI + "content/main.js");

    if (_shutdownRequested) return;

    JIF = new globalThis.JIFPlugin(rootURI);
    await JIF.startup();

    maybePingHome(version);
  })();
  await _startupPromise;
}

async function shutdown({ id, version, rootURI }, reason) {
  _shutdownRequested = true;
  // Wait for any in-progress startup to finish before tearing down, so we
  // don't leave registered columns/rows without a corresponding unregister.
  if (_startupPromise) {
    try { await _startupPromise; } catch (e) {}
    _startupPromise = null;
  }
  if (JIF) {
    await JIF.shutdown();
    JIF = undefined;
  }
  // Null out globals injected by loadSubScript so they can be GC'd.
  // Cu.unload() is only for Cu.import() ES modules — do NOT use it here.
  if (typeof globalThis !== "undefined") {
    globalThis.JIFData = undefined;
    globalThis.JIFPlugin = undefined;
  }
}

function install(data, reason) {}
function uninstall(data, reason) {}
