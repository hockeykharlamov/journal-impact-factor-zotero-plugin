// Cloudflare Worker for the Journal Impact Factor Zotero plugin.
//
// Two endpoints:
//   GET  /update.json  → returns the plugin update manifest (Zotero polls this
//                        automatically every 24h). Each hit is logged.
//   POST /ping         → optional active-install heartbeat from the plugin
//                        (throttled to once/24h per install). Each hit is logged.
//
// Logging goes to Cloudflare Analytics Engine via the ANALYTICS binding
// (add it in the dashboard: Settings → Bindings → Add → Analytics Engine,
//  variable name ANALYTICS, dataset name jif_plugin_pings).
//
// Query the data later with the Workers Analytics Engine SQL API.

const UPDATE_MANIFEST = {
  addons: {
    "journal-impact-factor@zotero.org": {
      updates: [
        {
          version: "1.0.3",
          update_link:
            "https://github.com/hockeykharlamov/journal-impact-factor-zotero-plugin/releases/download/v1.0.3/journal-impact-factor.xpi",
          applications: {
            zotero: {
              strict_min_version: "7.0",
              strict_max_version: "9.0.99",
            },
          },
        },
      ],
    },
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Log every interesting hit. Best-effort; never fail the response.
    try {
      if (env.ANALYTICS) {
        const ip = request.headers.get("cf-connecting-ip") || "";
        const ua = request.headers.get("user-agent") || "";
        const country = request.cf?.country || "";
        env.ANALYTICS.writeDataPoint({
          indexes: [url.pathname],
          blobs: [url.pathname, ip, ua, country],
          doubles: [1],
        });
      }
    } catch (_) {}

    if (request.method === "GET" && url.pathname === "/update.json") {
      return new Response(JSON.stringify(UPDATE_MANIFEST), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/ping") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
