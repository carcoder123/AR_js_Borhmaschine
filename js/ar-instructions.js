/**
 * AR.js AR-Anleitung – Bohrmaschine
 * Verwaltet die Anzeige von AR-Anweisungen basierend auf Barcode-Markern
 *
 * Hinweise zur AR.js-Event-API (aframe-ar.js):
 * - Bei Marker-Erkennung dispatcht AR.js auf window:
 *     new CustomEvent('markerFound', { detail: markerControls })
 *   mit markerControls.parameters.barcodeValue = Barcode-Nummer (0-511).
 * - Zusätzlich emittiert das <a-marker>-Element selbst 'markerFound'/'markerLost'.
 * - Beide Wege werden hier unterstützt (Fallback), wichtig ist die Barcode-Nummer.
 */

(function() {
  'use strict';

  // Anweisungen pro Marker (barcodeValue)
  const instructions = {
    '0': {
      title: 'Einschalter',
      text: 'Drücken Sie den roten Einschalter, um die Bohrmaschine zu starten.',
      steps: [
        'Suchen Sie den roten Einschalter an der Seite der Bohrmaschine',
        'Drücken Sie den Schalter einmal kurz für den Ein-Betrieb',
        'Halten Sie den Schalter gedrückt für den Dauerbetrieb'
      ]
    },
    '1': {
      title: 'Bohrfutter',
      text: 'Das Bohrfutter spannt den Bohrer. Drehen Sie den Ring gegen den Uhrzeigersinn zum Öffnen.',
      steps: [
        'Drehen Sie den Spannringer gegen den Uhrzeigersinn',
        'Legen Sie den Bohrer mit dem Schaft in die Aufnahme',
        'Ziehen Sie den Spannringer fest – der Bohrer sitzt'
      ]
    },
    '2': {
      title: 'Drehzahlregler',
      text: 'Der Drehzahlregler stellt die Geschwindigkeit ein. Drehe den Ring für hohe/niedrige Drehzahlen.',
      steps: [
        'Der Ring mit der Zahlenskala (1-10) regelt die Drehzahl',
        'Niedrige Drehzahl (1-3): Für Metall oder kleine Bohrungen',
        'Hohe Drehzahl (7-10): Für Holz oder große Bohrungen'
      ]
    },
    '3': {
      title: 'Sägeguide',
      text: 'Der Sägeguide dient auch als Tiefenanschlag. Verstellen Sie ihn für die gewünschte Bohrtiefe.',
      steps: [
        'Lösen Sie die Schraube am Sägeguide',
        'Verstellen Sie die Position für die gewünschte Bohrtiefe',
        'Ziehen Sie die Schraube wieder fest'
      ]
    }
  };

  let currentInstruction = null;
  let markerHideTimeout = null;

  /**
   * Zeigt die Anweisung für einen erkannten Marker an
   */
  function showInstruction(markerId) {
    const instruction = instructions[markerId];
    if (!instruction) return;

    if (currentInstruction === markerId) return;
    currentInstruction = markerId;

    let overlay = document.getElementById('ar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ar-overlay';
      overlay.className = 'ar-instruction';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <h3 style="color: #00ff88; margin-bottom: 8px;">${instruction.title}</h3>
      <p style="margin-bottom: 8px;">${instruction.text}</p>
      <ul style="text-align: left; font-size: 0.85rem; color: #aaa;">
        ${instruction.steps.map(s => `<li>${s}</li>`).join('')}
      </ul>
    `;

    overlay.classList.remove('hidden');
    console.log(`[AR] Anweisung für Marker "${markerId}" angezeigt`);
  }

  /**
   * Versteckt die aktuelle Anweisung
   */
  function hideInstruction() {
    currentInstruction = null;
    const overlay = document.getElementById('ar-overlay');
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
    }, 500);
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
   * Initialisiert die AR-Szene und Event-Listener
   */
  function init() {
    console.log('[AR] AR-Anleitung initialisiert');

    // Primärweg: AR.js dispatcht markerFound/markerLost als CustomEvent auf window
    window.addEventListener('markerFound', function(e) {
      const value = barcodeValueFromDetail(e.detail);
      if (value !== null) onFound(value);
    });
    window.addEventListener('markerLost', function(e) {
      const value = barcodeValueFromDetail(e.detail);
      if (value !== null) onLost(value);
    });

    // Fallback: das <a-marker>-Element emittiert selbst markerFound/markerLost;
    // die Barcode-Nummer steht dort im value-Attribut des Elements
    document.querySelectorAll('a-marker[type="barcode"]').forEach(function(el) {
      const value = String(el.getAttribute('value'));
      el.addEventListener('markerFound', function() { onFound(value); });
      el.addEventListener('markerLost', function() { onLost(value); });
    });

    // Ladebildschirm ausblenden
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.classList.add('hidden');
      }
    }, 3000);

    // Kamera-Fehler abfangen – AR.js macht das selbst, wir brauchen keinen eigenen Aufruf
  }

  // Globale Funktionen
  window.arInstructions = {
    show: showInstruction,
    hide: hideInstruction,
    getInstructions: function() { return instructions; }
  };

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
