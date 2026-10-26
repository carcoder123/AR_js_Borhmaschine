/**
 * GitHub-API-Schicht für die Config-App.
 *
 * Liest und schreibt Dateien im AR-Projekt-Repository direkt über die
 * GitHub REST API. Schreiben läuft über die Git-Data-API (Blobs → Tree →
 * Commit → Ref-Update), damit mehrere Dateien in EINEM Commit landen und
 * auch größere Dateien (3D-Modelle) kein Größenlimit der Contents-API
 * reißen.
 *
 * Der Token wird nur im localStorage des Browsers gespeichert und nie
 * ins Repository geschrieben. Empfehlung: feingranularer Token, nur
 * dieses Repository, Berechtigung "Contents: Read and write".
 */

(function(global) {
  'use strict';

  var LS_KEY = 'ar_config_app_gh';

  // Projekt-Repository als Vorgabe (Lesen funktioniert ohne Token bei
  // öffentlichen Repos; zum Schreiben ist ein Token nötig).
  var DEFAULTS = { owner: 'carcoder123', repo: 'AR_js_Borhmaschine', branch: 'main', token: '' };

  function settings() {
    var s;
    try {
      s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch (e) {
      s = {};
    }
    return Object.assign({}, DEFAULTS, s);
  }

  function saveSettings(s) {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  }

  function apiBase(s) {
    return 'https://api.github.com';
  }

  function headers(s) {
    var h = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (s.token) h['Authorization'] = 'Bearer ' + s.token;
    return h;
  }

  async function api(s, path, opts) {
    opts = opts || {};
    var res;
    try {
      res = await fetch(apiBase(s) + path, {
        method: opts.method || 'GET',
        headers: Object.assign(headers(s), opts.headers || {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      // fetch selbst fehlgeschlagen (kein HTTP-Fehler, sondern Netz/CORS)
      var hint = (location.protocol === 'file:')
        ? ' Die App wurde per Doppelklick (file://) geöffnet – Firefox blockiert dann alle API-Aufrufe. Bitte über http://localhost:8080/config_app/ oder die GitHub-Pages-URL öffnen.'
        : ' Mögliche Ursachen: kein Internet, Blocker/NoScript blockiert api.github.com, oder der Seitenkontext ist ungültig.';
      var err = new Error('Netzwerkfehler beim Aufruf der GitHub-API.' + hint + ' [' + (e.name || 'Error') + ': ' + (e.message || '') + ']');
      err.network = true;
      throw err;
    }
    if (!res.ok) {
      var detail = '';
      try {
        var j = await res.json();
        detail = (j && j.message) ? ' – ' + j.message : '';
      } catch (e) { /* ignore */ }
      var err = new Error('GitHub API ' + res.status + ' ' + path + detail);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ---------- Lesen ----------

  /** Datei-Inhalt lesen (String oder null, wenn nicht vorhanden) */
  async function readFile(path) {
    // 1. Relativ zur App laden (funktioniert lokal per http.server und auf
    //    GitHub Pages, da die App im selben Repo liegt).
    try {
      var rel = await fetch('../' + path + '?t=' + Date.now(), { cache: 'no-store' });
      if (rel.ok) return await rel.text();
      if (rel.status !== 404) throw new Error('HTTP ' + rel.status + ' bei ' + path);
    } catch (e) {
      if (!/HTTP/.test(e.message)) throw e; // Netzwerkfehler -> nicht schlucken
    }
    // 2. Über GitHub API / raw.githubusercontent
    var s = settings();
    if (s.token) {
      try {
        var j = await api(s, '/repos/' + s.owner + '/' + s.repo + '/contents/' + encodeURI(path) + '?ref=' + encodeURIComponent(s.branch || 'main'));
        if (j.encoding === 'base64') {
          return decodeBase64(j.content);
        }
        return decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    }
    // ohne Token: raw.githubusercontent (nur öffentliche Repos)
    var res = await fetch('https://raw.githubusercontent.com/' + s.owner + '/' + s.repo + '/' + (s.branch || 'main') + '/' + path + '?t=' + Date.now());
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HTTP ' + res.status + ' beim Lesen von ' + path);
    return res.text();
  }

  /** Verzeichnis auflisten: [{name, path, size, download_url}] */
  async function listDir(dirPath) {
    var s = settings();
    var j = await api(s, '/repos/' + s.owner + '/' + s.repo + '/contents/' + encodeURI(dirPath) + '?ref=' + encodeURIComponent(s.branch || 'main'));
    return j.filter(function(x) { return x.type === 'file'; })
            .map(function(x) { return { name: x.name, path: x.path, size: x.size }; });
  }

  // ---------- base64-Helfer ----------

  function bytesToBase64(bytes) {
    var chunk = 0x8000;
    var out = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(out);
  }

  function decodeBase64(b64) {
    var clean = b64.replace(/\n/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function blobToBytes(blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }

  // ---------- Schreiben (Git Data API, ein Commit für alle Dateien) ----------

  /**
   * files: [{path: 'images/x.png', data: Blob | Uint8Array | string}]
   * Erzeugt genau einen Commit auf dem konfigurierten Branch.
   * Rückgabe: {commitSha, commitUrl, treeSha}
   */
  async function commitFiles(files, message) {
    var s = settings();
    if (!s.token) throw new Error('Kein GitHub-Token gesetzt (siehe Einstellungen).');
    if (!files.length) throw new Error('Keine Änderungen zu committen.');
    var branch = s.branch || 'main';
    var base = '/repos/' + s.owner + '/' + s.repo;

    // 1. Aktueller Head des Branches
    var ref = await api(s, base + '/git/ref/heads%2F' + encodeURIComponent(branch));
    var headSha = ref.object.sha;

    // 2. Basis-Tree des Head-Commits
    var headCommit = await api(s, base + '/git/commits/' + headSha);
    var baseTree = headCommit.tree.sha;

    // 3. Blobs erzeugen
    var tree = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var content, encoding;
      if (typeof f.data === 'string') {
        content = btoa(unescape(encodeURIComponent(f.data)));
        encoding = 'base64';
      } else if (f.data instanceof Uint8Array) {
        content = bytesToBase64(f.data);
        encoding = 'base64';
      } else if (f.data instanceof Blob) {
        content = bytesToBase64(await blobToBytes(f.data));
        encoding = 'base64';
      } else {
        throw new Error('Unbekannter Datentyp für ' + f.path);
      }
      var blob = await api(s, base + '/git/blobs', {
        method: 'POST',
        body: { content: content, encoding: encoding }
      });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 4. Tree erzeugen
    var newTree = await api(s, base + '/git/trees', {
      method: 'POST',
      body: { base_tree: baseTree, tree: tree }
    });

    // 5. Commit erzeugen
    var commit = await api(s, base + '/git/commits', {
      method: 'POST',
      body: { message: message, tree: newTree.sha, parents: [headSha] }
    });

    // 6. Branch auf den neuen Commit setzen (nicht force – Kollision = Fehler)
    try {
      await api(s, base + '/git/refs/heads/' + encodeURIComponent(branch), {
        method: 'PATCH',
        body: { sha: commit.sha, force: false }
      });
    } catch (e) {
      throw new Error('Commit erstellt, aber Branch-Update fehlgeschlagen (' + e.message + '). ' +
        'Der Commit ' + commit.sha.slice(0, 7) + ' existiert – ggf. Konflikt durch parallele Änderungen.');
    }

    return {
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      treeSha: newTree.sha
    };
  }

  /** Verbindung testen: Token gültig? Repo erreichbar? Schreibrecht? */
  async function testConnection() {
    var s = settings();
    var me = await api(s, '/user');
    var repo = await api(s, '/repos/' + s.owner + '/' + s.repo);
    var perm = repo.permissions || {};
    return {
      user: me.login,
      repo: repo.full_name,
      private: !!repo.private,
      canPush: !!(perm.push || repo.allow_update)
    };
  }

  global.GH = {
    settings: settings,
    saveSettings: saveSettings,
    readFile: readFile,
    listDir: listDir,
    commitFiles: commitFiles,
    testConnection: testConnection,
    bytesToBase64: bytesToBase64
  };

})(window);
