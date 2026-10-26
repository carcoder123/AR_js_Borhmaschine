/**
 * AR.js Config-App – UI-Logik
 *
 * Verwaltet beliebig viele Maschinen ("Top-Level"): Jede Maschine hat ihre
 * eigene Marker-Liste (config/machines/<id>.json), die Registry steht in
 * config/machines.json (inkl. globaler Kamera-/Overlay-Einstellungen).
 *
 * Änderungen werden per GitHub-API als Commits ins Repo gepusht; GitHub
 * Pages baut danach automatisch neu – kein eigener Server nötig.
 *
 * AR-Seiten-URLs: index.html                -> erste Maschine
 *                 index.html?machine=<id>   -> bestimmte Maschine
 */

(function() {
  'use strict';

  // ---------- Konstanten ----------

  var REGISTRY_PATH = 'config/machines.json';
  var MACHINE_DIR = 'config/machines/';
  var MARKER_DIR = 'marker/';
  var IMAGES_DIR = 'images/';
  var MODELS_DIR = '3d_models/';

  var DEFAULT_GH = { owner: 'carcoder123', repo: 'AR_js_Borhmaschine', branch: 'main', token: '' };

  // ---------- Zustand ----------

  var state = {
    registry: null,        // config/machines.json (machines + scene + overlay)
    registryOriginal: null,
    machineFiles: {},      // id -> { data, original }   (Daten der Maschinen-Dateien)
    selectedMachine: null, // id der aktuellen Maschine
    config: null,          // = machineFiles[selectedMachine].data (Shortcut)
    selected: null,        // Index des ausgewählten Markers
    pending: {},           // path -> {data, label} für den nächsten Commit
    imagesList: [],
    modelsList: [],
    isNew: false,          // aktueller Marker ist noch nicht gespeichert
    newMachineIds: [],     // in dieser Sitzung neu angelegte Maschinen
    saving: false
  };

  var $ = function(sel) { return document.querySelector(sel); };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    (children || []).forEach(function(c) { if (c) e.appendChild(c); });
    return e;
  }

  function fmt(n, d) {
    return (typeof n === 'number' && isFinite(n)) ? n : d;
  }

  function num(v, def) {
    var n = parseFloat(v);
    return (typeof n === 'number' && isFinite(n)) ? n : def;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function slug(s) {
    return String(s || '').toLowerCase()
      .replace(/[äöüß]/g, function(c) { return ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' })[c]; })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'maschine';
  }

  function setStatus(msg, kind) {
    var s = $('#status');
    s.textContent = msg;
    s.className = kind || '';
  }

  function curMachine() {
    return state.machineFiles[state.selectedMachine] || null;
  }

  function machineById(id) {
    return state.machineFiles[id] || null;
  }

  // ---------- Templates ----------

  function newMarkerTemplate(value, title) {
    return {
      value: value,
      id: 'marker-' + slug(title),
      title: title,
      color: '#00ff88',
      smooth: true,
      smoothCount: 3,
      frame: { enabled: true, opacity: 0.45 },
      ring: { enabled: true, radiusInner: 0.3, radiusOuter: 0.36, pulseDur: 900, pulseScale: 1.15, opacity: 0.9 },
      beacon: { enabled: true, shape: 'octahedron', radius: 0.12, height: 0.3, spinDur: 6000, bobDur: 1200 },
      panel: { enabled: true, image: '', width: 0.8, height: 0.5, positionY: 0.82, bgColor: '#1a1a2e', bgOpacity: 0.92, titleSize: 1 },
      model: { enabled: false, src: '', position: [0, 0.55, 0], scale: 0.3, spinSpeed: 45, titleHeight: 1.05 },
      instruction: { title: title, text: '', steps: [] }
    };
  }

  function newMachineTemplate(id, name) {
    var gh = GH.settings();
    var pagesBase = 'https://' + gh.owner + '.github.io/' + gh.repo + '/';
    return {
      id: id,
      name: name,
      qrUrl: pagesBase + '?machine=' + id,
      qrFile: 'qr/' + id + '.png',
      revision: 1,
      markers: []
    };
  }

  function usedValues() {
    return ((state.config && state.config.markers) || []).map(function(m) { return m.value; });
  }

  function freeValues() {
    var used = usedValues();
    var free = [];
    for (var i = 0; i <= ARCodes.MAX_VALUE; i++) {
      if (used.indexOf(i) === -1) free.push(i);
    }
    return free;
  }

  // ---------- Laden ----------

  async function loadAll() {
    setStatus('Lade Konfiguration…');
    var regText = await GH.readFile(REGISTRY_PATH);
    if (regText == null) throw new Error(REGISTRY_PATH + ' nicht gefunden.');
    var reg;
    try {
      reg = JSON.parse(regText);
    } catch (e) {
      throw new Error('machines.json ist kein gültiges JSON: ' + e.message);
    }
    reg.machines = reg.machines || [];
    state.registry = reg;
    state.registryOriginal = JSON.stringify(reg);

    // Alle Maschinen-Dateien laden
    state.machineFiles = {};
    await Promise.all(reg.machines.map(async function(entry) {
      var id = entry.id;
      var text = await GH.readFile(MACHINE_DIR + id + '.json');
      if (text == null) {
        console.warn('[ConfigApp] Maschinen-Datei fehlt:', id);
        state.machineFiles[id] = { data: newMachineTemplate(id, entry.name || id), original: null };
        return;
      }
      var data = JSON.parse(text);
      state.machineFiles[id] = { data: data, original: JSON.stringify(data) };
    }));

    state.pending = {};
    state.isNew = false;

    var first = reg.machines.length ? reg.machines[0].id : null;
    selectMachine(first);
    fillGlobalForm();
    updateDirty();
    setStatus('Geladen. ' + reg.machines.length + ' Maschine(n).', 'ok');
  }

  // ---------- Maschinen ----------

  function machineChanged(id) {
    var mf = machineById(id);
    if (!mf) return false;
    return JSON.stringify(mf.data) !== mf.original;
  }

  function changedMachineFiles() {
    var out = [];
    Object.keys(state.machineFiles).forEach(function(id) {
      if (machineChanged(id)) out.push(id);
    });
    return out;
  }

  function renderMachineList() {
    var list = $('#machine-list');
    list.innerHTML = '';
    (state.registry.machines || []).forEach(function(entry) {
      var mf = machineById(entry.id);
      var data = mf ? mf.data : { markers: [] };
      var item = el('div', { 'class': 'machine-item' + (entry.id === state.selectedMachine ? ' active' : '') });
      var label = el('div', { 'class': 'machine-label' });
      label.innerHTML = '<b>' + esc(data.name || entry.id) + '</b><br><span class="dim">' +
        (data.markers || []).length + ' Marker' +
        (machineChanged(entry.id) ? ' · geändert' : '') +
        (state.newMachineIds.indexOf(entry.id) !== -1 ? ' · neu' : '') + '</span>';
      item.appendChild(label);
      item.addEventListener('click', function() { selectMachine(entry.id); });
      list.appendChild(item);
    });
  }

  function selectMachine(id) {
    if (!id || !machineById(id)) {
      var first = (state.registry.machines || [])[0];
      id = first ? first.id : null;
    }
    state.selectedMachine = id;
    state.config = machineById(id) ? machineById(id).data : null;
    state.selected = null;
    state.isNew = false;

    $('#marker-form').style.display = 'none';
    $('#global-form').style.display = 'none';

    if (state.config && state.config.markers && state.config.markers.length) {
      selectMarker(0);
    }
    renderMachineList();
    renderMarkerList();
    fillGlobalForm();
    updateDirty();
    updatePreview();
  }

  function addMachine() {
    var name = prompt('Name der neuen Maschine (z. B. "Schraubstock"):', '');
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    var id = slug(name);
    if (machineById(id)) {
      alert('Eine Maschine mit der ID "' + id + '" existiert bereits.');
      return;
    }
    var tpl = newMachineTemplate(id, name);
    state.machineFiles[id] = { data: tpl, original: null };
    state.registry.machines.push({ id: id, name: name });
    state.newMachineIds.push(id);
    selectMachine(id);
    showGlobalOnly();
    updateDirty();
    // QR-Code für die neue Maschine automatisch erzeugen und vormerken
    generateQrBlob(tpl.qrUrl).then(function(blob) {
      // Maschine könnte inzwischen wieder gelöscht worden sein
      if (!machineById(id)) return;
      var path = tpl.qrFile || ('qr/' + id + '.png');
      state.pending[path] = { data: blob, label: 'QR-Code (' + tpl.qrUrl + ')', machine: id };
      refreshPendingList();
      updateDirty();
      fillGlobalForm();
      setStatus('Maschine "' + name + '" angelegt – QR-Code automatisch vorgemerkt (' + path + ').', 'ok');
    }).catch(function(e) {
      setStatus('Maschine "' + name + '" angelegt, aber QR-Code konnte nicht erzeugt werden: ' + e.message, 'err');
    });
  }

  function deleteMachine() {
    var id = state.selectedMachine;
    var mf = machineById(id);
    if (!mf) return;
    var n = (mf.data.markers || []).length;
    var pushedNote = (state.newMachineIds.indexOf(id) === -1)
      ? 'Die Maschinen-Datei bleibt im Repo bestehen (kann dort manuell gelöscht werden).'
      : 'Wichtig: Die Maschine wurde noch nie gepusht – nach dem Speichern existiert sie weder im Repo noch hier.';
    if (!confirm('Maschine "' + (mf.data.name || id) + '" wirklich löschen?\n\n' +
        n + ' Marker gehen verloren. Hochgeladene Dateien (Bilder, Modelle, Barcodes) bleiben im Repo.\n' + pushedNote)) return;

    dropPendingForMachine(id);
    state.registry.machines = state.registry.machines.filter(function(m) { return m.id !== id; });
    delete state.machineFiles[id];
    state.newMachineIds = state.newMachineIds.filter(function(x) { return x !== id; });
    state.selectedMachine = null;
    state.config = null;
    state.selected = null;
    var first = (state.registry.machines || [])[0];
    if (first) {
      selectMachine(first.id);
    } else {
      showGlobalOnly();
      renderMachineList();
      renderMarkerList();
      fillGlobalForm();
    }
    updateDirty();
  }

  // ---------- Dirty / Speichern-Button ----------

  function isDirty() {
    if (JSON.stringify(state.registry) !== state.registryOriginal) return true;
    if (changedMachineFiles().length) return true;
    return Object.keys(state.pending).length > 0;
  }

  function updateDirty() {
    var d = isDirty();
    var fileCount = Object.keys(state.pending).length + changedMachineFiles().length +
      (JSON.stringify(state.registry) !== state.registryOriginal ? 1 : 0);
    var btn = $('#btn-save');
    btn.disabled = !d || state.saving;
    btn.textContent = d ? 'Speichern & Pushen (' + fileCount + ' Dateien, 1 Commit)' : 'Alles gespeichert';
    $('#dot-dirty').style.visibility = d ? 'visible' : 'hidden';
  }

  // ---------- Markerliste ----------

  function renderMarkerList() {
    var list = $('#marker-list');
    list.innerHTML = '';

    if (!state.config) {
      list.innerHTML = '<p class="dim">Keine Maschine ausgewählt.</p>';
      $('#add-zone').innerHTML = '';
      return;
    }

    var markers = (state.config.markers || []).slice().sort(function(a, b) { return a.value - b.value; });
    markers.forEach(function(m) {
      var idx = state.config.markers.indexOf(m);
      var item = el('div', { 'class': 'marker-item' + (idx === state.selected ? ' active' : '') });
      var thumb = el('canvas', { width: 64, height: 64, 'class': 'thumb' });
      var c = thumb.getContext('2d');
      var src = ARCodes.drawBarcode(m.value, 64);
      if (src) c.drawImage(src, 0, 0);
      var label = el('div', { 'class': 'marker-label' });
      label.innerHTML = '<b>' + esc(m.title) + '</b><br><span class="dim">Barcode ' + m.value +
        (m.panel && m.panel.enabled ? ' · Bild' : '') + (m.model && m.model.enabled ? ' · 3D' : '') + '</span>';
      var dot = el('span', { 'class': 'color-dot', style: 'background:' + esc(m.color) });
      item.appendChild(thumb);
      item.appendChild(label);
      item.appendChild(dot);
      item.addEventListener('click', function() { selectMarker(idx); });
      list.appendChild(item);
    });

    if (!markers.length) {
      list.innerHTML = '<p class="dim">Diese Maschine hat noch keine Marker.<br>Unten einen freien Barcode wählen.</p>';
    }

    var add = $('#add-zone');
    add.innerHTML = '';
    var free = freeValues();
    if (!free.length) {
      add.innerHTML = '<p class="dim">Alle ' + (ARCodes.MAX_VALUE + 1) + ' Barcodes (0–' + ARCodes.MAX_VALUE + ') sind bei dieser Maschine belegt.</p>';
    } else {
      var p = el('p', { 'class': 'dim' });
      p.textContent = 'Neuer Marker (freie Barcodes):';
      add.appendChild(p);
      var row = el('div', { 'class': 'free-row' });
      free.forEach(function(v) {
        var b = el('button', { 'class': 'btn small free-value' });
        b.textContent = v;
        b.addEventListener('click', function() { addMarker(v); });
        row.appendChild(b);
      });
      add.appendChild(row);
    }
  }

  function addMarker(value) {
    var title = prompt('Titel für den neuen Marker (Barcode ' + value + '):', 'Neuer Marker');
    if (title === null) return;
    title = title.trim() || ('Marker ' + value);
    var m = newMarkerTemplate(value, title);
    state.config.markers.push(m);
    state.isNew = true;
    state.selected = state.config.markers.length - 1;
    queueBarcode(value);
    renderMachineList();
    renderMarkerList();
    selectMarker(state.selected);
    updateDirty();
  }

  function deleteMarker(idx) {
    var m = state.config.markers[idx];
    if (!confirm('Marker "' + m.title + '" (Barcode ' + m.value + ') wirklich löschen?\n\nHinweis: Die hochgeladenen Dateien (Barcode-Bild, Bilder, Modelle) bleiben im Repo und müssen ggf. manuell gelöscht werden.')) return;
    state.config.markers.splice(idx, 1);
    state.isNew = false;
    state.selected = null;
    renderMarkerList();
    showGlobalOnly();
    updateDirty();
  }

  // ---------- Marker-Formular ----------

  function selectMarker(idx) {
    state.selected = idx;
    state.isNew = false;
    $('#marker-form').style.display = '';
    $('#global-form').style.display = 'none';
    $('#btn-edit-global').classList.remove('active');
    fillMarkerForm();
    renderMarkerList();
    updatePreview();
  }

  function showGlobalOnly() {
    $('#marker-form').style.display = 'none';
    $('#global-form').style.display = '';
    $('#btn-edit-global').classList.add('active');
    fillGlobalForm();
    updatePreview();
  }

  function curMarker() {
    return (state.selected != null && state.config) ? state.config.markers[state.selected] : null;
  }

  function fillMarkerForm() {
    var m = curMarker();
    if (!m) return;
    $('#f-value').textContent = m.value;
    $('#f-id').value = m.id || '';
    $('#f-title').value = m.title || '';
    $('#f-color').value = m.color || '#00ff88';
    $('#f-smooth').checked = m.smooth !== false;
    $('#f-smooth-count').value = fmt(m.smoothCount, 3);

    $('#f-frame').checked = !!(m.frame && m.frame.enabled);
    $('#f-frame-opacity').value = fmt(m.frame && m.frame.opacity, 0.45);

    var r = m.ring || {};
    $('#f-ring').checked = !!r.enabled;
    $('#f-ring-inner').value = fmt(r.radiusInner, 0.3);
    $('#f-ring-outer').value = fmt(r.radiusOuter, 0.36);
    $('#f-ring-dur').value = fmt(r.pulseDur, 900);
    $('#f-ring-scale').value = fmt(r.pulseScale, 1.15);
    $('#f-ring-opacity').value = fmt(r.opacity, 0.9);

    var b = m.beacon || {};
    $('#f-beacon').checked = !!b.enabled;
    $('#f-beacon-shape').value = b.shape || 'octahedron';
    $('#f-beacon-radius').value = fmt(b.radius, 0.12);
    $('#f-beacon-height').value = fmt(b.height, 0.3);
    $('#f-beacon-spin').value = fmt(b.spinDur, 6000);
    $('#f-beacon-bob').value = fmt(b.bobDur, 1200);

    var p = m.panel || {};
    $('#f-panel').checked = !!p.enabled;
    $('#f-panel-image').value = p.image || '';
    $('#f-panel-w').value = fmt(p.width, 0.8);
    $('#f-panel-h').value = fmt(p.height, 0.5);
    $('#f-panel-y').value = fmt(p.positionY, 0.82);
    $('#f-panel-bg').value = p.bgColor || '#1a1a2e';
    $('#f-panel-bgopacity').value = fmt(p.bgOpacity, 0.92);
    $('#f-panel-tsize').value = fmt(p.titleSize, 1);

    var mod = m.model || {};
    $('#f-model').checked = !!mod.enabled;
    $('#f-model-src').value = mod.src || '';
    var pos = mod.position || [0, 0.55, 0];
    $('#f-model-px').value = fmt(pos[0], 0);
    $('#f-model-py').value = fmt(pos[1], 0.55);
    $('#f-model-pz').value = fmt(pos[2], 0);
    $('#f-model-scale').value = fmt(mod.scale, 0.3);
    $('#f-model-spin').value = fmt(mod.spinSpeed, 45);
    $('#f-model-titley').value = fmt(mod.titleHeight, 1.05);

    var ins = m.instruction || {};
    $('#f-ins-title').value = ins.title || '';
    $('#f-ins-text').value = ins.text || '';
    $('#f-ins-steps').value = (ins.steps || []).join('\n');

    drawBarcodePreview();
    fillImageSelect();
    fillModelSelect();
  }

  function collectMarkerForm() {
    var m = curMarker();
    if (!m) return;
    m.id = $('#f-id').value.trim() || ('marker-' + m.value);
    m.title = $('#f-title').value.trim() || ('Marker ' + m.value);
    m.color = $('#f-color').value;
    m.smooth = $('#f-smooth').checked;
    m.smoothCount = num($('#f-smooth-count').value, 3);

    m.frame = m.frame || {};
    m.frame.enabled = $('#f-frame').checked;
    m.frame.opacity = num($('#f-frame-opacity').value, 0.45);

    m.ring = m.ring || {};
    m.ring.enabled = $('#f-ring').checked;
    m.ring.radiusInner = num($('#f-ring-inner').value, 0.3);
    m.ring.radiusOuter = num($('#f-ring-outer').value, 0.36);
    m.ring.pulseDur = num($('#f-ring-dur').value, 900);
    m.ring.pulseScale = num($('#f-ring-scale').value, 1.15);
    m.ring.opacity = num($('#f-ring-opacity').value, 0.9);

    m.beacon = m.beacon || {};
    m.beacon.enabled = $('#f-beacon').checked;
    m.beacon.shape = $('#f-beacon-shape').value;
    m.beacon.radius = num($('#f-beacon-radius').value, 0.12);
    m.beacon.height = num($('#f-beacon-height').value, 0.3);
    m.beacon.spinDur = num($('#f-beacon-spin').value, 6000);
    m.beacon.bobDur = num($('#f-beacon-bob').value, 1200);

    m.panel = m.panel || {};
    m.panel.enabled = $('#f-panel').checked;
    m.panel.image = $('#f-panel-image').value.trim();
    m.panel.width = num($('#f-panel-w').value, 0.8);
    m.panel.height = num($('#f-panel-h').value, 0.5);
    m.panel.positionY = num($('#f-panel-y').value, 0.82);
    m.panel.bgColor = $('#f-panel-bg').value;
    m.panel.bgOpacity = num($('#f-panel-bgopacity').value, 0.92);
    m.panel.titleSize = num($('#f-panel-tsize').value, 1);

    m.model = m.model || {};
    m.model.enabled = $('#f-model').checked;
    m.model.src = $('#f-model-src').value.trim();
    m.model.position = [num($('#f-model-px').value, 0), num($('#f-model-py').value, 0.55), num($('#f-model-pz').value, 0)];
    m.model.scale = num($('#f-model-scale').value, 0.3);
    m.model.spinSpeed = num($('#f-model-spin').value, 45);
    m.model.titleHeight = num($('#f-model-titley').value, 1.05);

    m.instruction = m.instruction || {};
    m.instruction.title = $('#f-ins-title').value.trim() || m.title;
    m.instruction.text = $('#f-ins-text').value.trim();
    m.instruction.steps = $('#f-ins-steps').value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
  }

  // ---------- Barcode ----------

  function drawBarcodePreview() {
    var m = curMarker();
    if (!m) return;
    var canvas = $('#barcode-preview');
    var c = canvas.getContext('2d');
    var src = ARCodes.drawBarcode(m.value, 944);
    if (src) {
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.drawImage(src, 0, 0, src.width, src.height, 0, 0, canvas.width, canvas.height);
    }
  }

  async function downloadBarcode() {
    var m = curMarker();
    if (!m) return;
    var blob = await ARCodes.toBlob(m.value, 944);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'barcode_' + m.value + '.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function queueBarcode(value) {
    var path = MARKER_DIR + 'barcode_' + value + '.png';
    return ARCodes.toBlob(value, 944).then(function(blob) {
      state.pending[path] = { data: blob, label: 'Barcode-Bild ' + value, machine: state.selectedMachine };
      updateDirty();
      refreshPendingList();
    });
  }

  /** Vormerkungen einer Maschine verwerfen (z. B. beim Löschen der Maschine) */
  function dropPendingForMachine(id) {
    Object.keys(state.pending).forEach(function(p) {
      if (state.pending[p].machine === id) delete state.pending[p];
    });
    refreshPendingList();
  }

  // ---------- Datei-Uploads ----------

  function sanitizeName(name) {
    var base = name.replace(/.*[\\/]/, '');
    var dot = base.lastIndexOf('.');
    var stem = dot > 0 ? base.slice(0, dot) : base;
    var ext = dot > 0 ? base.slice(dot) : '';
    return slug(stem) + ext.toLowerCase();
  }

  function wireUpload(inputId, dir, fieldId) {
    $('#' + inputId).addEventListener('change', async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var m = curMarker();
      if (!m) return;
      var name = sanitizeName(file.name);
      var path = dir + name;
      var buf = new Uint8Array(await file.arrayBuffer());
      state.pending[path] = { data: buf, label: name, machine: state.selectedMachine };
      $('#' + fieldId).value = path;
      collectMarkerForm();
      refreshPendingList();
      updateDirty();
      updatePreview();
      setStatus('Datei "' + name + '" bereit – wird beim Speichern hochgeladen.', 'ok');
      e.target.value = '';
    });
  }

  function fillImageSelect() {
    fillFileSelect('#f-image-select', state.imagesList, '#f-panel-image');
  }
  function fillModelSelect() {
    fillFileSelect('#f-model-select', state.modelsList, '#f-model-src');
  }

  function fillFileSelect(sel, list, fieldSel) {
    var selEl = $(sel);
    var field = $(fieldSel);
    selEl.innerHTML = '';
    var opt = el('option', { value: '' });
    opt.textContent = '– Datei wählen –';
    selEl.appendChild(opt);
    var current = field.value;
    var found = false;
    (list || []).forEach(function(f) {
      var o = el('option', { value: f.path });
      o.textContent = f.path + ' (' + Math.round(f.size / 1024) + ' KB)';
      if (f.path === current) { o.selected = true; found = true; }
      selEl.appendChild(o);
    });
    if (current && !found) {
      var o2 = el('option', { value: current });
      o2.textContent = current + ' (im Repo nicht gefunden)';
      o2.selected = true;
      selEl.appendChild(o2);
    }
  }

  // ---------- Globale Einstellungen ----------

  function fillGlobalForm() {
    // Aktuelle Maschine
    var mf = curMachine();
    var data = mf ? mf.data : null;
    $('#m-name').value = data ? (data.name || '') : '';
    $('#m-qr-url').value = data ? (data.qrUrl || '') : '';
    $('#m-qr-file').textContent = data ? (data.qrFile || ('qr/' + (data.id || '') + '.png')) : '–';
    $('#btn-del-machine').style.display = state.selectedMachine ? '' : 'none';

    // Projekt-global (Registry)
    var reg = state.registry || {};
    var s = reg.scene || {};
    $('#g-source-w').value = fmt(s.sourceWidth, 640);
    $('#g-source-h').value = fmt(s.sourceHeight, 480);
    $('#g-display-w').value = fmt(s.displayWidth, 640);
    $('#g-display-h').value = fmt(s.displayHeight, 480);
    $('#g-detection').value = s.detectionMode || 'mono_and_matrix';
    $('#g-matrix').value = s.matrixCodeType || '3x3_HAMMING63';
    var o = reg.overlay || {};
    $('#g-hide-delay').value = fmt(o.hideDelayMs, 500);
    $('#g-loading-ms').value = fmt(o.loadingMs, 3000);

    var gh = Object.assign({}, DEFAULT_GH, GH.settings());
    $('#gh-owner').value = gh.owner;
    $('#gh-repo').value = gh.repo;
    $('#gh-branch').value = gh.branch;
    $('#gh-token').value = gh.token;

    fillQrPreview();
  }

  function collectGlobalForm() {
    // Aktuelle Maschine
    var mf = curMachine();
    if (mf && mf.data) {
      mf.data.name = $('#m-name').value.trim() || mf.data.id;
      mf.data.qrUrl = $('#m-qr-url').value.trim();
      // Namen auch in der Registry pflegen (für AR-Seiten-Links)
      (state.registry.machines || []).forEach(function(entry) {
        if (entry.id === mf.data.id) entry.name = mf.data.name;
      });
    }

    // Projekt-global
    var reg = state.registry;
    reg.scene = reg.scene || {};
    reg.scene.sourceWidth = num($('#g-source-w').value, 640);
    reg.scene.sourceHeight = num($('#g-source-h').value, 480);
    reg.scene.displayWidth = num($('#g-display-w').value, 640);
    reg.scene.displayHeight = num($('#g-display-h').value, 480);
    reg.scene.detectionMode = $('#g-detection').value;
    reg.scene.matrixCodeType = $('#g-matrix').value;
    reg.overlay = reg.overlay || {};
    reg.overlay.hideDelayMs = num($('#g-hide-delay').value, 500);
    reg.overlay.loadingMs = num($('#g-loading-ms').value, 3000);

    GH.saveSettings({
      owner: $('#gh-owner').value.trim(),
      repo: $('#gh-repo').value.trim(),
      branch: $('#gh-branch').value.trim() || 'main',
      token: $('#gh-token').value.trim()
    });
  }

  /**
   * Erzeugt den QR-Code als Blob (PNG) für eine URL
   */
  function generateQrBlob(url) {
    var qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    var count = qr.getModuleCount();
    var scale = Math.max(2, Math.floor(300 / count));
    var size = count * scale;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }
    return new Promise(function(res, rej) {
      canvas.toBlob(function(b) { b ? res(b) : rej(new Error('toBlob fehlgeschlagen')); }, 'image/png');
    });
  }

  /** Zeichnet die QR-Vorschau für die URL im Eingabefeld */
  function fillQrPreview() {
    var canvas = $('#qr-preview');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var url = $('#m-qr-url').value.trim();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!url) {
      ctx.fillStyle = '#8b97ad';
      ctx.font = '13px sans-serif';
      ctx.fillText('Keine URL gesetzt', 45, 122);
      return;
    }
    try {
      var qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      var count = qr.getModuleCount();
      var scale = Math.max(2, Math.floor(canvas.width / count));
      var offset = Math.floor((canvas.width - count * scale) / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) ctx.fillRect(offset + c * scale, offset + r * scale, scale, scale);
        }
      }
    } catch (e) {
      ctx.fillStyle = '#ff5566';
      ctx.font = '12px sans-serif';
      ctx.fillText('QR-Fehler: ' + String(e.message).slice(0, 24), 10, 122);
    }
  }

  async function regenerateQR() {
    var mf = curMachine();
    if (!mf || !mf.data) return;
    var url = $('#m-qr-url').value.trim();
    if (!url) { setStatus('Keine QR-URL gesetzt.', 'err'); return; }
    try {
      var blob = await generateQrBlob(url);
      var path = mf.data.qrFile || ('qr/' + mf.data.id + '.png');
      state.pending[path] = { data: blob, label: 'QR-Code (' + url + ')', machine: state.selectedMachine };
      refreshPendingList();
      updateDirty();
      setStatus('QR-Code erzeugt – wird beim Speichern als ' + path + ' hochgeladen.', 'ok');
    } catch (e) {
      setStatus('QR-Fehler: ' + e.message, 'err');
    }
  }

  async function checkMissingBarcodes() {
    setStatus('Prüfe Barcode-Bilder im Repo…');
    try {
      var files = await GH.listDir(MARKER_DIR);
      var have = {};
      files.forEach(function(f) { have[f.name] = true; });
      var missing = [];
      ((state.config && state.config.markers) || []).forEach(function(m) {
        if (!have['barcode_' + m.value + '.png']) missing.push(m.value);
      });
      if (!missing.length) {
        setStatus('Alle Barcode-Bilder dieser Maschine sind im Repo vorhanden.', 'ok');
      } else {
        missing.forEach(function(v) { queueBarcode(v); });
        setStatus('Fehlende Barcode-Bilder bereitgestellt: ' + missing.join(', '), 'ok');
      }
    } catch (e) {
      setStatus('Konnte marker/ nicht listen: ' + e.message, 'err');
    }
  }

  // ---------- Vorschau ----------

  var previewTimer = null;
  function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(buildPreview, 250);
  }

  function buildPreview() {
    var m = curMarker();
    if (!m) {
      $('#preview-frame').srcdoc = '<p style="font-family:sans-serif;color:#888;padding:2em">Kein Marker ausgewählt</p>';
      return;
    }
    var doc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<base href="../">' +
      '<script src="https://aframe.io/releases/1.6.0/aframe.min.js"><\/script>' +
      '<style>body{margin:0;background:#111827;color:#94a3b8;font-family:sans-serif}' +
      '.hint{position:fixed;bottom:6px;left:8px;font-size:11px;opacity:.6}' +
      '</style></head><body>' +
      '<div class="hint">Schematische Vorschau (ohne AR-Kamera)</div>' +
      '<a-scene embedded background="color: #111827" renderer="antialias: true; alpha: true">' +
      previewMarkerHTML(m) +
      '<a-entity camera position="0 0.7 1.6" look-controls="enabled: false"></a-entity>' +
      '</a-scene>' +
      '<script>' +
      'AFRAME.registerComponent("face-camera",{init:function(){this._c=window.THREE?new THREE.Vector3():null},tick:function(){var c=this.el.sceneEl&&this.el.sceneEl.camera;if(!c||!this._c)return;c.getWorldPosition(this._c);this.el.object3D.lookAt(this._c);}});' +
      'AFRAME.registerComponent("upright-spin",{schema:{speed:{type:"number",default:45}},init:function(){this._a=0;this._l=null;this._t=window.THREE?new THREE.Vector3():null},tick:function(t,dt){if(!this._t)return;if(this._l===null){this._l=t;return}var d=Math.min(dt||0,100);this._l=t;this._a=(this._a+this.data.speed*d/1000)%360;var c=this.el.sceneEl&&this.el.sceneEl.camera;if(!c)return;c.getWorldPosition(this._t);this.el.object3D.lookAt(this._t);this.el.object3D.rotateY(THREE.MathUtils.degToRad(this._a));}});' +
      '<\/script></body></html>';
    $('#preview-frame').srcdoc = doc;
  }

  function previewMarkerHTML(m) {
    var out = '';
    if (m.frame && m.frame.enabled) {
      out += '<a-box width="1" height="1" depth="0.004" position="0 0 0" material="wireframe: true; color: ' + esc(m.color) + '; opacity: ' + fmt(m.frame.opacity, 0.45) + '; transparent: true"></a-box>';
    }
    if (m.ring && m.ring.enabled) {
      out += '<a-ring position="0 0 0.01" radius-inner="' + fmt(m.ring.radiusInner, 0.3) + '" radius-outer="' + fmt(m.ring.radiusOuter, 0.36) + '" segments-theta="64" color="' + esc(m.color) + '" material="shader: flat; opacity: ' + fmt(m.ring.opacity, 0.9) + '; transparent: true; side: double" animation="property: scale; from: 1 1 1; to: ' + fmt(m.ring.pulseScale, 1.15) + ' ' + fmt(m.ring.pulseScale, 1.15) + ' ' + fmt(m.ring.pulseScale, 1.15) + '; dir: alternate; loop: true; dur: ' + fmt(m.ring.pulseDur, 900) + '; easing: easeInOutSine"></a-ring>';
    }
    if (m.beacon && m.beacon.enabled) {
      var shape = m.beacon.shape === 'box' ? 'a-box' : 'a-octahedron';
      var shAttrs = m.beacon.shape === 'box'
        ? 'width="' + fmt(m.beacon.radius, 0.12) * 2 + '" height="' + fmt(m.beacon.radius, 0.12) * 2 + '" depth="' + fmt(m.beacon.radius, 0.12) * 2 + '"'
        : 'radius="' + fmt(m.beacon.radius, 0.12) + '"';
      out += '<a-entity position="0 0 ' + fmt(m.beacon.height, 0.3) + '" animation="property: rotation; to: 360 360 0; loop: true; dur: ' + fmt(m.beacon.spinDur, 6000) + '; easing: linear" animation__bob="property: position; from: 0 0 ' + (fmt(m.beacon.height, 0.3) - 0.08) + '; to: 0 0 ' + (fmt(m.beacon.height, 0.3) + 0.08) + '; dir: alternate; loop: true; dur: ' + fmt(m.beacon.bobDur, 1200) + '; easing: easeInOutSine"><' + shape + ' ' + shAttrs + ' color="' + esc(m.color) + '" material="opacity: 0.85; transparent: true; metalness: 0.2; roughness: 0.4"></' + shape + '></a-entity>';
    }
    if (m.model && m.model.enabled && m.model.src) {
      var pos = m.model.position || [0, 0.55, 0];
      var s = fmt(m.model.scale, 0.3);
      out += '<a-entity gltf-model="' + esc(m.model.src) + '" position="' + pos[0] + ' ' + pos[1] + ' ' + pos[2] + '" scale="' + s + ' ' + s + ' ' + s + '" upright-spin="speed: ' + fmt(m.model.spinSpeed, 45) + '"></a-entity>';
      if (!m.panel || !m.panel.enabled) {
        out += '<a-entity position="0 ' + fmt(m.model.titleHeight, 1.05) + ' 0" face-camera><a-text value="' + esc(m.title) + '" align="center" anchor="center" width="' + fmt(m.panel && m.panel.titleSize, 1.2) + '" color="' + esc(m.color) + '" position="0 0 0.01"></a-text></a-entity>';
      }
    }
    if (m.panel && m.panel.enabled && m.panel.image) {
      var w = fmt(m.panel.width, 0.8), h = fmt(m.panel.height, 0.5);
      out += '<a-entity position="0 ' + fmt(m.panel.positionY, 0.82) + ' 0" face-camera>' +
        '<a-box position="0 0 -0.005" width="' + (w + 0.04) + '" height="' + (h + 0.04) + '" depth="0.006" material="color: ' + esc(m.panel.bgColor || '#1a1a2e') + '; opacity: ' + fmt(m.panel.bgOpacity, 0.92) + '; transparent: true; side: double"></a-box>' +
        '<a-plane src="' + esc(m.panel.image) + '" width="' + w + '" height="' + h + '" position="0 0 0.002" material="shader: flat; transparent: true; opacity: 0.97; side: double"></a-plane>' +
        '<a-text value="' + esc(m.title) + '" align="center" anchor="center" width="' + fmt(m.panel.titleSize, 1) + '" color="' + esc(m.color) + '" position="0 ' + (h / 2 + 0.08) + ' 0.005"></a-text>' +
        '</a-entity>';
    }
    return out;
  }

  // ---------- Pending-Liste ----------

  function refreshPendingList() {
    var box = $('#pending-list');
    var paths = Object.keys(state.pending);
    if (!paths.length) {
      box.innerHTML = '<span class="dim">keine neuen Dateien</span>';
      return;
    }
    box.innerHTML = paths.map(function(p) {
      return '<span class="pending-chip" title="' + esc(state.pending[p].label) + '">' + esc(p) + '</span>';
    }).join('');
  }

  // ---------- Speichern & Pushen ----------

  async function save() {
    if (state.saving) return;
    if (state.selected != null) collectMarkerForm();
    collectGlobalForm();

    var gh = GH.settings();
    if (!gh.token) {
      showGlobalOnly();
      setStatus('Kein GitHub-Token gesetzt – siehe Einstellungen unten.', 'err');
      return;
    }

    var files = [];

    // Registry (wenn geändert)
    if (JSON.stringify(state.registry) !== state.registryOriginal) {
      files.push({ path: REGISTRY_PATH, data: JSON.stringify(state.registry, null, 2) + '\n' });
    }

    // Geänderte Maschinen-Dateien (Revision erhöhen, außer bei ganz neuen Maschinen)
    changedMachineFiles().forEach(function(id) {
      var mf = machineById(id);
      if (state.newMachineIds.indexOf(id) === -1) {
        mf.data.revision = num(mf.data.revision, 1) + 1;
      }
      files.push({ path: MACHINE_DIR + id + '.json', data: JSON.stringify(mf.data, null, 2) + '\n' });
    });

    // Neue Dateien (Barcodes, Bilder, Modelle, QR)
    Object.keys(state.pending).forEach(function(p) {
      files.push({ path: p, data: state.pending[p].data });
    });

    if (!files.length) { updateDirty(); return; }

    var msg = commitMessage(changedMachineFiles(), Object.keys(state.pending).length);

    state.saving = true;
    updateDirty();
    setStatus('Pushing ' + files.length + ' Datei(en) zu GitHub…');
    try {
      var res = await GH.commitFiles(files, msg);
      // Originale aktualisieren
      state.registryOriginal = JSON.stringify(state.registry);
      changedMachineFiles().forEach(function(id) {
        state.machineFiles[id].original = JSON.stringify(state.machineFiles[id].data);
      });
      state.newMachineIds = [];
      state.pending = {};
      state.isNew = false;
      refreshPendingList();
      updateDirty();
      renderMachineList();
      setStatus('✔ Pushed: ' + res.commitSha.slice(0, 7) + ' – GitHub Pages baut in 1–2 Minuten neu. Lokal: git pull.', 'ok');
      var link = $('#commit-link');
      link.href = res.commitUrl;
      link.textContent = 'Commit auf GitHub ansehen';
      link.style.display = '';
      await loadRepoLists();
    } catch (e) {
      // Revisionen zurücksetzen, damit ein erneuter Versuch nicht doppelte Revisionen erzeugt
      changedMachineFiles().forEach(function(id) {
        var mf = machineById(id);
        if (state.newMachineIds.indexOf(id) === -1) {
          mf.data.revision = Math.max(1, num(mf.data.revision, 1) - 1);
        }
      });
      updateDirty();
      setStatus('✖ Fehler: ' + e.message, 'err');
    } finally {
      state.saving = false;
      updateDirty();
    }
  }

  function commitMessage(changedIds, assetCount) {
    var assetInfo = assetCount ? ' + ' + assetCount + ' Datei(en)' : '';
    var regChanged = JSON.stringify(state.registry) !== state.registryOriginal;
    if (changedIds.length === 1 && !regChanged) {
      var data = machineById(changedIds[0]).data;
      var isNewMachine = state.newMachineIds.indexOf(changedIds[0]) !== -1;
      var verb = isNewMachine ? 'hinzugefügt' : 'aktualisiert';
      return 'Config-App: Maschine "' + (data.name || changedIds[0]) + '" ' + verb + assetInfo;
    }
    if (changedIds.length > 1 || (regChanged && changedIds.length)) {
      return 'Config-App: Maschinen aktualisiert (' + changedIds.join(', ') + ')' + assetInfo;
    }
    return 'Config-App: Konfiguration aktualisiert' + assetInfo;
  }

  async function loadRepoLists() {
    try {
      var results = await Promise.all([
        GH.listDir(IMAGES_DIR).catch(function() { return []; }),
        GH.listDir(MODELS_DIR).catch(function() { return []; })
      ]);
      state.imagesList = results[0];
      state.modelsList = results[1];
      fillImageSelect();
      fillModelSelect();
    } catch (e) { /* Listen sind optional */ }
  }

  // ---------- GitHub-Einstellungen ----------

  async function testConnection() {
    collectGlobalForm();
    if (location.protocol === 'file:') {
      setStatus('✖ App läuft über file:// – Firefox blockiert hier alle API-Aufrufe. Bitte über http://localhost:8080/config_app/ (python3 -m http.server 8080 im Projektordner) oder die GitHub-Pages-URL öffnen.', 'err');
      return;
    }
    setStatus('Teste GitHub-Verbindung…');
    try {
      var r = await GH.testConnection();
      setStatus('✔ Verbunden als ' + r.user + ' · ' + r.repo + (r.private ? ' (privat)' : ' (öffentlich)') + (r.canPush ? ' · Push-Recht OK' : ' · ⚠ kein Push-Recht!'), r.canPush ? 'ok' : 'err');
    } catch (e) {
      setStatus('✖ ' + e.message, 'err');
    }
  }

  // ---------- Start ----------

  function wireEvents() {
    $('#btn-save').addEventListener('click', save);
    $('#btn-reload').addEventListener('click', function() {
      if (isDirty() && !confirm('Ungespeicherte Änderungen verwerfen und neu laden?')) return;
      loadAll().catch(function(e) { setStatus('✖ ' + e.message, 'err'); });
    });
    $('#btn-add-machine').addEventListener('click', addMachine);
    $('#btn-del-machine').addEventListener('click', deleteMachine);
    $('#btn-edit-global').addEventListener('click', function() {
      if (state.selected != null) collectMarkerForm();
      showGlobalOnly();
    });
    $('#btn-del-marker').addEventListener('click', function() {
      if (state.selected != null) deleteMarker(state.selected);
    });
    $('#btn-barcode-dl').addEventListener('click', downloadBarcode);
    $('#btn-barcode-queue').addEventListener('click', function() {
      var m = curMarker();
      if (m) { queueBarcode(m.value); }
    });
    $('#btn-check-barcodes').addEventListener('click', checkMissingBarcodes);
    $('#btn-qr-regen').addEventListener('click', regenerateQR);
    $('#btn-gh-test').addEventListener('click', testConnection);

    // Formular -> Zustand + Vorschau (live)
    ['input', 'change'].forEach(function(evt) {
      ['#marker-form', '#global-form'].forEach(function(f) {
        $(f).addEventListener(evt, function(e) {
          if (['gh-token', 'gh-owner', 'gh-repo', 'gh-branch'].indexOf(e.target.id) !== -1) {
            collectGlobalForm();
            return;
          }
          if (state.selected != null) collectMarkerForm();
          collectGlobalForm();
          if (e.target.id === 'm-name') renderMachineList();
          if (e.target.id === 'm-qr-url') fillQrPreview();
          updateDirty();
          updatePreview();
        });
      });
    });

    $('#f-image-select').addEventListener('change', function(e) {
      if (e.target.value) {
        $('#f-panel-image').value = e.target.value;
        collectMarkerForm();
        updateDirty();
        updatePreview();
      }
    });
    $('#f-model-select').addEventListener('change', function(e) {
      if (e.target.value) {
        $('#f-model-src').value = e.target.value;
        collectMarkerForm();
        updateDirty();
        updatePreview();
      }
    });

    wireUpload('f-image-upload', IMAGES_DIR, 'f-panel-image');
    wireUpload('f-model-upload', MODELS_DIR, 'f-model-src');

    // Tastenkürzel Strg+S
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty()) save();
      }
    });
  }

  async function init() {
    wireEvents();
    refreshPendingList();
    if (location.protocol === 'file:') {
      setStatus('⚠ App über file:// geöffnet – daraus kann die Konfiguration nicht geladen werden. Bitte über http://localhost:8080/config_app/ oder die GitHub-Pages-URL öffnen.', 'err');
    }
    try {
      await loadAll();
      await loadRepoLists();
      fillMarkerForm(); // Dropdowns nach Listen-Laden neu befüllen
    } catch (e) {
      var msg = e.message;
      if (location.protocol === 'file:') {
        msg = 'App wurde per Doppelklick (file://) geöffnet – daraus kann die Konfiguration nicht geladen werden. Bitte über http://localhost:8080/config_app/ oder die GitHub-Pages-URL öffnen. [' + msg + ']';
      }
      setStatus('✖ ' + msg, 'err');
      $('#machine-list').innerHTML = '<p class="dim">Konnte die Konfiguration nicht laden.<br>' + esc(msg) + '</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
