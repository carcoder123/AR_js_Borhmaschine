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

  // Panel-Entities mit `face-camera` drehen sich jeden Frame zur Kamera.
  // So ist die Anleitungstafel immer aufrecht und lesbar, egal wie der
  // Barcode-Marker auf der Maschine geklebt ist (sonst rotiert das Panel
  // mit dem Marker mit und steht je nach Kleberichtung schief/auf dem Kopf).
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
  }

  // Entities mit `upright-spin` bleiben immer aufrecht (Hochachse zeigt
  // nach oben, wie auf dem Handybildschirm) und drehen sich gleichzeitig
  // um ihre eigene Hochachse – z. B. für 3D-Modelle an einem Marker.
  // Geschwindigkeit: `upright-spin="speed: 45"` (Grad pro Sekunde).
  if (window.AFRAME) {
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

        // Wie face-camera: zuerst zur Kamera ausrichten (lookAt hält die
        // Hochachse über den Up-Vektor aufrecht), dann um die eigene
        // Hochachse weiterdrehen.
        cam.getWorldPosition(this._target);
        this.el.object3D.lookAt(this._target);
        this.el.object3D.rotateY(THREE.MathUtils.degToRad(this._angle));
      }
    });
  }

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
    },
    '4': {
      title: '3D-Modell',
      text: 'Das Modell dreht sich automatisch. Bewegen Sie das Handy darum herum, um es von allen Seiten zu betrachten.',
      steps: [
        'Das Modell bleibt immer aufrecht',
        'Es dreht sich langsam um seine Hochachse',
        'Mit dem Handy herumgehen für die Seitenansicht'
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
