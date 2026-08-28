/**
 * AR.js AR-Anleitung – Bohrmaschine
 * Verwaltet die Anzeige von AR-Anweisungen basierend auf Barcode-Markern
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
  let lastDetectedMarker = null;
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
   * Versteckt die aktuelle Anweisung nach Verlassen des Markers
   */
  function hideInstruction() {
    currentInstruction = null;
    const overlay = document.getElementById('ar-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  /**
   * Event-Handler für marker-detected (AR.js 3.x)
   */
  function onMarkerDetected(event) {
    // AR.js 3.x: event.detail enthält die Marker-Informationen
    if (event.detail && event.detail.markerId) {
      const markerId = event.detail.markerId;
      if (instructions[markerId]) {
        showInstruction(markerId);
        lastDetectedMarker = markerId;
      }
    }
    // AR.js 2.x: event.detail.type kann die barcodeValue sein
    else if (event.detail && event.detail.type) {
      const markerId = String(event.detail.type);
      if (instructions[markerId]) {
        showInstruction(markerId);
        lastDetectedMarker = markerId;
      }
    }
  }

  /**
   * Event-Handler für marker-undetect (wenn Marker verlassen wird)
   */
  function onMarkerUndetected(event) {
    if (event.detail && event.detail.markerId) {
      const markerId = event.detail.markerId;
      if (markerId === lastDetectedMarker) {
        // Verzögertes Ausblenden für flüssigeres Erlebnis
        if (markerHideTimeout) clearTimeout(markerHideTimeout);
        markerHideTimeout = setTimeout(hideInstruction, 500);
      }
    }
  }

  /**
   * Initialisiert die AR-Szene und Event-Listener
   */
  function init() {
    console.log('[AR] AR-Anleitung initialisiert');

    // Event-Listener für Marker-Erkennung (AR.js 3.x)
    document.addEventListener('marker-detected', onMarkerDetected);
    document.addEventListener('marker-undetect', onMarkerUndetected);

    // Alternative: A-Frame Event
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('markerFound', function(evt) {
        if (evt.detail && evt.detail.markerId && instructions[evt.detail.markerId]) {
          showInstruction(evt.detail.markerId);
          lastDetectedMarker = evt.detail.markerId;
        }
      });
      scene.addEventListener('markerLost', function(evt) {
        if (evt.detail && evt.detail.markerId) {
          if (markerHideTimeout) clearTimeout(markerHideTimeout);
          markerHideTimeout = setTimeout(hideInstruction, 500);
        }
      });
    }

    // Ladebildschirm ausblenden
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.classList.add('hidden');
      }
    }, 3000);

    // Kamera-Fehler abfangen
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
          console.warn('[AR] Kamera-Zugriff verweigert:', err);
          const loading = document.getElementById('loading');
          if (loading) {
            loading.innerHTML = `
              <p style="color: #ff6b6b;">⚠️ Kamera-Zugriff erforderlich</p>
              <p class="small" style="margin-top: 0.5rem;">Bitte erlauben Sie den Kamera-Zugriff in Ihren Browsereinstellungen.</p>
            `;
          }
        });
    }
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
