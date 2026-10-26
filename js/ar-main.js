/**
 * AR.js AR-Anleitung – Szenen-Builder
 * Baut die AR-Szene dynamisch aus config/markers.json auf.
 *
 * Ablauf:
 *   1. Registriert die A-Frame-Komponenten face-camera und upright-spin
 *   2. Lädt config/markers.json (immer frisch, kein Browser-Cache)
 *   3. Erzeugt das komplette <a-scene>-Markup aus der Konfiguration
 *   4. Hängt die Szene ins DOM (A-Frame initialisiert beim Einfügen)
 *   5. Übergibt die Konfiguration an ar-instructions.js (Text-Overlay)
 *
 * Die Marker-Blöcke entsprechen exakt dem bisherigen handgeschriebenen
 * Format – nur eben aus der JSON-Konfiguration generiert.
 */

(function() {
  'use strict';

  // ---------- A-Frame-Komponenten ----------

  // Entities mit `face-camera` drehen sich jeden Frame zur Kamera.
  // So ist die Anleitungstafel immer aufrecht und lesbar, egal wie der
  // Barcode-Marker auf der Maschine geklebt ist.
  if (window.AFRAME) {
    AFRAME.registerComponent('face-camera', {
      init: function () {
        this._camPos = (window.THREE) ? new THREE.Vector3() : null;
      },
      tick: function () {
        var cam = this.el.sceneEl && this.el.sceneEl.camera;
        if (!cam || !this._camPos) return;
        cam.getWorldPosition(this._camPos);
        this.el.object3D.lookAt(this._camPos);
      }
    });

    // Entities mit `upright-spin` bleiben immer aufrecht und drehen sich
    // gleichzeitig um ihre eigene Hochachse (Grad pro Sekunde).
    AFRAME.registerComponent('upright-spin', {
      schema: { speed: { type: 'number', default: 45 } },
      init: function () {
        this._angle = 0;
        this._last = null;
        this._target = (window.THREE) ? new THREE.Vector3() : null;
      },
      tick: function (t, dt) {
        if (!this._target) return;
        if (this._last === null) { this._last = t; return; }
        var d = Math.min(dt || 0, 100);
        this._last = t;
        this._angle = (this._angle + this.data.speed * d / 1000) % 360;

        var cam = this.el.sceneEl && this.el.sceneEl.camera;
        if (!cam) return;

        cam.getWorldPosition(this._target);
        this.el.object3D.lookAt(this._target);
        this.el.object3D.rotateY(THREE.MathUtils.degToRad(this._angle));
      }
    });
  }

  // ---------- Hilfsfunktionen ----------

  function num(v, def) {
    var n = parseFloat(v);
    if (typeof n !== 'number' || !isFinite(n)) return def;
    return Math.round(n * 10000) / 10000; // Float-Artefakte vermeiden
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function attrs(obj) {
    var parts = [];
    for (var k in obj) {
      if (obj[k] === null || obj[k] === undefined) continue;
      parts.push(k + '="' + esc(obj[k]) + '"');
    }
    return parts.join(' ');
  }

  // ---------- Marker-Markup ----------

  function frameHTML(m) {
    if (!m.frame || !m.frame.enabled) return '';
    return '      <a-box ' + attrs({
      'width': 1, 'height': 1, 'depth': 0.004, 'position': '0 0 0',
      'material': 'wireframe: true; color: ' + m.color + '; opacity: ' + num(m.frame.opacity, 0.45) + '; transparent: true'
    }) + '></a-box>\n';
  }

  function ringHTML(m) {
    var r = m.ring;
    if (!r || !r.enabled) return '';
    return '      <a-ring ' + attrs({
      'position': '0 0 0.01',
      'radius-inner': num(r.radiusInner, 0.3),
      'radius-outer': num(r.radiusOuter, 0.36),
      'segments-theta': 64,
      'color': m.color,
      'material': 'shader: flat; opacity: ' + num(r.opacity, 0.9) + '; transparent: true; side: double',
      'animation': 'property: scale; from: 1 1 1; to: ' + num(r.pulseScale, 1.15) + ' ' + num(r.pulseScale, 1.15) + ' ' + num(r.pulseScale, 1.15) +
        '; dir: alternate; loop: true; dur: ' + num(r.pulseDur, 900) + '; easing: easeInOutSine'
    }) + '></a-ring>\n';
  }

  function beaconHTML(m) {
    var b = m.beacon;
    if (!b || !b.enabled) return '';
    var h = num(b.height, 0.3);
    var shape = (b.shape === 'box') ? 'a-box' : 'a-octahedron';
    var shapeAttrs = (b.shape === 'box')
      ? attrs({ 'width': num(b.radius, 0.12) * 2, 'height': num(b.radius, 0.12) * 2, 'depth': num(b.radius, 0.12) * 2 })
      : attrs({ 'radius': num(b.radius, 0.12) });
    return (
      '      <a-entity ' + attrs({
        'position': '0 0 ' + h,
        'animation': 'property: rotation; to: 360 360 0; loop: true; dur: ' + num(b.spinDur, 6000) + '; easing: linear',
        'animation__bob': 'property: position; from: 0 0 ' + (h - 0.08) + '; to: 0 0 ' + (h + 0.08) + '; dir: alternate; loop: true; dur: ' + num(b.bobDur, 1200) + '; easing: easeInOutSine'
      }) + '>\n' +
      '        <' + shape + ' ' + shapeAttrs + ' color="' + m.color + '" material="opacity: 0.85; transparent: true; metalness: 0.2; roughness: 0.4"></' + shape + '>\n' +
      '      </a-entity>\n'
    );
  }

  function panelHTML(m, rev) {
    var p = m.panel;
    if (!p || !p.enabled || !p.image) return '';
    var w = num(p.width, 0.8), hgt = num(p.height, 0.5);
    var src = p.image + (p.image.indexOf('?') === -1 ? '?v=' + rev : '');
    return (
      '      <a-entity position="0 ' + num(p.positionY, 0.82) + ' 0" face-camera>\n' +
      '        <a-box position="0 0 -0.005" width="' + (w + 0.04) + '" height="' + (hgt + 0.04) + '" depth="0.006" ' +
               'material="color: ' + esc(p.bgColor || '#1a1a2e') + '; opacity: ' + num(p.bgOpacity, 0.92) + '; transparent: true; side: double"></a-box>\n' +
      '        <a-plane src="' + esc(src) + '" width="' + w + '" height="' + hgt + '" position="0 0 0.002" ' +
               'material="shader: flat; transparent: true; opacity: 0.97; side: double"></a-plane>\n' +
      '        <a-text value="' + esc(m.title) + '" align="center" anchor="center" width="' + num(p.titleSize, 1) + '" ' +
               'color="' + m.color + '" position="0 ' + (hgt / 2 + 0.08) + ' 0.005"></a-text>\n' +
      '      </a-entity>\n'
    );
  }

  function modelHTML(m) {
    var mod = m.model;
    if (!mod || !mod.enabled || !mod.src) return '';
    var pos = mod.position || [0, 0.55, 0];
    var s = num(mod.scale, 0.3);
    var out = (
      '      <a-entity ' + attrs({
        'gltf-model': '#model-v' + m.value,
        'position': pos[0] + ' ' + pos[1] + ' ' + pos[2],
        'scale': s + ' ' + s + ' ' + s,
        'upright-spin': 'speed: ' + num(mod.spinSpeed, 45)
      }) + '></a-entity>\n'
    );
    // Titel über dem Modell, wenn kein Bild-Panel aktiv ist
    if (!m.panel || !m.panel.enabled) {
      out += (
        '      <a-entity position="0 ' + num(mod.titleHeight, 1.05) + ' 0" face-camera>\n' +
        '        <a-text value="' + esc(m.title) + '" align="center" anchor="center" width="' + num(m.panel && m.panel.titleSize, 1.2) + '" ' +
                 'color="' + m.color + '" position="0 0 0.01"></a-text>\n' +
        '      </a-entity>\n'
      );
    }
    return out;
  }

  function markerHTML(m, rev) {
    var smooth = (m.smooth === false) ? '' : ' smooth="true" smooth-count="' + num(m.smoothCount, 3) + '"';
    return (
      '    <!-- Marker: ' + esc(m.title) + ' (Barcode ' + m.value + ') -->\n' +
      '    <a-marker type="barcode" value="' + m.value + '" id="' + esc(m.id || ('marker-' + m.value)) + '"' + smooth + '>\n' +
      frameHTML(m) + ringHTML(m) + beaconHTML(m) + modelHTML(m) + panelHTML(m, rev) +
      '    </a-marker>\n'
    );
  }

  // ---------- Szenen-Markup ----------

  function sceneHTML(cfg) {
    var assets = '';
    (cfg.markers || []).forEach(function (m) {
      if (m.model && m.model.enabled && m.model.src) {
        assets += '      <a-asset-item id="model-v' + m.value + '" src="' + esc(m.model.src) + '"></a-asset-item>\n';
      }
    });

    var markers = '';
    (cfg.markers || []).forEach(function (m) {
      markers += markerHTML(m, num(cfg.revision, 1));
    });

    return (
      '    <a-assets>\n' + (assets || '      <!-- keine 3D-Modelle -->\n') + '    </a-assets>\n' +
      markers +
      '    <a-entity camera></a-entity>\n    ');
  }

  function buildScene(cfg) {
    var scene = document.createElement('a-scene');
    var s = cfg.scene || {};
    var arjs = 'sourceType: webcam; sourceWidth: ' + num(s.sourceWidth, 640) + '; sourceHeight: ' + num(s.sourceHeight, 480) +
      '; displayWidth: ' + num(s.displayWidth, 640) + '; displayHeight: ' + num(s.displayHeight, 480) +
      '; debugUIEnabled: false; detectionMode: ' + esc(s.detectionMode || 'mono_and_matrix') +
      '; matrixCodeType: ' + esc(s.matrixCodeType || '3x3_HAMMING63') + ';';

    scene.setAttribute('embedded', '');
    scene.setAttribute('arjs', arjs);
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('renderer', 'logarithmicDepthBuffer: true; antialias: true; alpha: true');
    scene.innerHTML = sceneHTML(cfg);
    document.body.appendChild(scene);

    if (typeof window.arInstructionsInit === 'function') {
      window.arInstructionsInit(cfg);
    }
  }

  function showError(msg) {
    var loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = '<p style="color:#ff5566">Fehler beim Laden der Konfiguration:</p><p class="small">' + esc(msg) + '</p>';
      loading.classList.remove('hidden');
    }
    console.error('[AR] Konfigurationsfehler:', msg);
  }

  // ---------- Maschinen-Auswahl & Desktop-Hinweis ----------

  function urlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  /**
   * Passt Titel, Desktop-Hinweis und QR-Code an die gewählte Maschine an
   * und listet weitere Maschinen als Umschalt-Links.
   */
  function updateDesktopHint(mf, reg) {
    document.title = mf.name + ' – AR Anleitung';
    var h1 = document.querySelector('#desktop-hinweis h1');
    if (h1) h1.textContent = '🔧 ' + mf.name + ' – AR Anleitung';

    // QR-Bild: pro Maschine, mit Fallback auf qr/qr-code.png
    var img = document.querySelector('#qr-section img');
    if (img) {
      var primary = mf.qrFile || ('qr/' + mf.id + '.png');
      img.onerror = function () {
        img.onerror = null;
        img.src = 'qr/qr-code.png';
      };
      img.src = primary;
    }

    // Weitere Maschinen als Links (nur Desktop-Hinweis)
    var others = (reg.machines || []).filter(function (m) { return m.id !== mf.id; });
    if (others.length) {
      var p = document.createElement('p');
      p.className = 'small';
      p.innerHTML = 'Weitere Maschinen: ' + others.map(function (m) {
        return '<a href="?machine=' + encodeURIComponent(m.id) + '">' + esc(m.name || m.id) + '</a>';
      }).join(' · ');
      var hint = document.getElementById('desktop-hinweis');
      if (hint) hint.appendChild(p);
    }
  }

  // ---------- Start ----------

  // Cache-Busting: Konfiguration immer frisch laden, damit Änderungen aus
  // der Config-App sofort sichtbar sind (ohne Cache-Rätselraten).
  //
  // Maschinen-Auswahl: ?machine=<id> in der URL, sonst die erste Maschine
  // in config/machines.json. Pro Maschine liegt eine eigene Datei unter
  // config/machines/<id>.json (Marker + Name + QR-URL).
  fetch('config/machines.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' bei config/machines.json');
      return r.json();
    })
    .then(function (reg) {
      var wanted = urlParam('machine');
      var entry = null;
      (reg.machines || []).forEach(function (m) {
        if (!entry && m.id === wanted) entry = m;
      });
      if (!entry) entry = (reg.machines || [])[0];
      if (!entry) throw new Error('Keine Maschinen in config/machines.json definiert.');

      return fetch('config/machines/' + encodeURIComponent(entry.id) + '.json?v=' + Date.now(), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' bei config/machines/' + entry.id + '.json');
          return r.json();
        })
        .then(function (mf) {
          mf.id = mf.id || entry.id;
          mf.name = mf.name || entry.name || entry.id;
          var cfg = {
            revision: mf.revision,
            markers: mf.markers || [],
            scene: reg.scene || {},
            overlay: reg.overlay || {}
          };
          window.MARKER_CONFIG = cfg;
          window.MARKER_MACHINE = mf;
          updateDesktopHint(mf, reg);
          buildScene(cfg);
        });
    })
    .catch(showError);

})();
