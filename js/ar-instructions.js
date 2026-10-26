/**
 * AR.js AR-Anleitung – Text-Overlay
 * Verwaltet die Anzeige von AR-Anweisungen basierend auf Barcode-Markern.
 *
 * Die Texte kommen aus config/markers.json (Feld "instruction" pro Marker)
 * und werden von js/ar-main.js nach dem Laden der Konfiguration über
 * window.arInstructionsInit(cfg) übergeben.
 *
 * Hinweise zur AR.js-Event-API (aframe-ar.js):
 * - Bei Marker-Erkennung dispatcht AR.js auf window:
 *     new CustomEvent('markerFound', { detail: markerControls })
 *   mit markerControls.parameters.barcodeValue = Barcode-Nummer (0-7).
 * - Zusätzlich emittiert das <a-marker>-Element selbst 'markerFound'/'markerLost'.
 * - Beide Wege werden hier unterstützt (Fallback), wichtig ist die Barcode-Nummer.
 */

(function() {
  'use strict';

  var instructions = {};
  var overlayConfig = { hideDelayMs: 500, loadingMs: 3000 };

  var currentInstruction = null;
  var markerHideTimeout = null;
  var initialized = false;

  /**
   * Zeigt die Anweisung für einen erkannten Marker an
   */
  function showInstruction(markerId) {
    var instruction = instructions[markerId];
    if (!instruction) return;

    var color = (instruction.color || '#00ff88');

    if (currentInstruction === markerId) return;
    currentInstruction = markerId;

    var overlay = document.getElementById('ar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ar-overlay';
      overlay.className = 'ar-instruction';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML =
      '<h3 style="color: ' + color + '; margin-bottom: 8px;">' + instruction.title + '</h3>' +
      '<p style="margin-bottom: 8px;">' + instruction.text + '</p>' +
      '<ul style="text-align: left; font-size: 0.85rem; color: #aaa;">' +
      (instruction.steps || []).map(function(s) { return '<li>' + s + '</li>'; }).join('') +
      '</ul>';

    overlay.classList.remove('hidden');
    console.log('[AR] Anweisung für Marker "' + markerId + '" angezeigt');
  }

  /**
   * Versteckt die aktuelle Anweisung
   */
  function hideInstruction() {
    currentInstruction = null;
    var overlay = document.getElementById('ar-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  /**
   * Marker erkannt – ggf. Ausblenden abbrechen, Anweisung zeigen
   */
  function onFound(markerId) {
    if (!(markerId in instructions)) return;
    if (markerHideTimeout) {
      clearTimeout(markerHideTimeout);
      markerHideTimeout = null;
    }
    showInstruction(markerId);
  }

  /**
   * Marker verlassen – Anweisung verzögert ausblenden
   */
  function onLost(markerId) {
    if (markerId !== currentInstruction) return;
    if (markerHideTimeout) clearTimeout(markerHideTimeout);
    markerHideTimeout = setTimeout(function() {
      markerHideTimeout = null;
      hideInstruction();
    }, overlayConfig.hideDelayMs);
  }

  /**
   * Liefert die Barcode-Nummer aus einem AR.js markerFound/markerLost-Event
   * (window-CustomEvent: detail = markerControls mit parameters.barcodeValue)
   */
  function barcodeValueFromDetail(detail) {
    if (detail && detail.parameters && detail.parameters.type === 'barcode') {
      return String(detail.parameters.barcodeValue);
    }
    return null;
  }

  /**
   * Wird von ar-main.js aufgerufen, sobald die Konfiguration geladen ist
   */
  function init(cfg) {
    if (initialized) return;
    initialized = true;

    instructions = {};
    (cfg.markers || []).forEach(function(m) {
      if (m.instruction && (m.instruction.text || (m.instruction.steps && m.instruction.steps.length))) {
        instructions[String(m.value)] = {
          title: m.instruction.title || m.title || '',
          text: m.instruction.text || '',
          steps: m.instruction.steps || [],
          color: m.color
        };
      }
    });

    if (cfg.overlay) overlayConfig = cfg.overlay;

    console.log('[AR] AR-Anleitung initialisiert (' + Object.keys(instructions).length + ' Marker-Texte)');

    // Primärweg: AR.js dispatcht markerFound/markerLost als CustomEvent auf window
    window.addEventListener('markerFound', function(e) {
      var value = barcodeValueFromDetail(e.detail);
      if (value !== null) onFound(value);
    });
    window.addEventListener('markerLost', function(e) {
      var value = barcodeValueFromDetail(e.detail);
      if (value !== null) onLost(value);
    });

    // Fallback: das <a-marker>-Element emittiert selbst markerFound/markerLost;
    // die Barcode-Nummer steht dort im value-Attribut des Elements
    document.querySelectorAll('a-marker[type="barcode"]').forEach(function(el) {
      var value = String(el.getAttribute('value'));
      el.addEventListener('markerFound', function() { onFound(value); });
      el.addEventListener('markerLost', function() { onLost(value); });
    });

    // Ladebildschirm ausblenden
    setTimeout(function() {
      var loading = document.getElementById('loading');
      if (loading) {
        loading.classList.add('hidden');
      }
    }, overlayConfig.loadingMs != null ? overlayConfig.loadingMs : 3000);
  }

  // Globale Funktionen
  window.arInstructions = {
    show: showInstruction,
    hide: hideInstruction,
    getInstructions: function() { return instructions; }
  };

  window.arInstructionsInit = init;

})();
