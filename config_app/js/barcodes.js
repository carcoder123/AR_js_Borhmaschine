/**
 * Barcode-Generator für AR.js 3x3 Hamming 6/3 Matrix-Marker.
 *
 * Die 8 Muster wurden pixelgenau aus der offiziellen Sammlung
 * (artoolkit-barcode-markers-collection, Ordner 3x3_hamming_6_3)
 * dekodiert und werden hier 1:1 nachgezeichnet – die erzeugten PNGs
 * sind daher identisch mit den Originalen (944x944 px, schwarzer
 * Grund, 3x3-Zellen à 157 px, Rand 236 px).
 *
 * Hinweis: Das Format 3x3_HAMMING63 hat physikalisch genau 8 gültige
 * Codes (Werte 0-7). Für mehr Marker müsste ein anderes Barcode-Format
 * genutzt werden (z. B. 3x3 ohne Hamming, 64 Werte).
 */

(function(global) {
  'use strict';

  // Bit-Raster (3x3, Zeile für Zeile, 1 = weiße Zelle) pro Barcode-Wert,
  // dekodiert aus den offiziellen Marker-PNGs.
  var PATTERNS = {
    0: [0,1,1, 1,1,1, 0,1,1],
    1: [0,1,1, 1,0,0, 0,0,1],
    2: [0,1,0, 0,1,1, 0,0,1],
    3: [0,1,0, 0,0,0, 0,1,1],
    4: [0,0,1, 0,1,0, 0,1,1],
    5: [0,0,1, 0,0,1, 0,0,1],
    6: [0,0,0, 1,1,0, 0,0,1],
    7: [0,0,0, 1,0,1, 0,1,1]
  };

  var MAX_VALUE = 7;

  function hasPattern(value) {
    return PATTERNS.hasOwnProperty(value) && PATTERNS[value] !== null;
  }

  /**
   * Zeichnet einen Barcode-Marker auf ein Canvas
   * @param {number} value     Barcode-Wert 0-7
   * @param {number} size      Ausgabegröße in Pixel (Standard 944 wie das Original)
   */
  function drawBarcode(value, size) {
    size = size || 944;
    if (!hasPattern(value)) return null;

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    // Schwarzer Grund (wie im Original: bis zum Rand schwarz)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    // Original-Geometrie: Musterbereich 471 px bei 944 px Gesamtgröße,
    // Rand 236 px, Zellen 157 px
    var scale = size / 944;
    var offset = Math.round(236 * scale);
    var cell = (size - 2 * offset) / 3;

    var bits = PATTERNS[value];
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 9; i++) {
      if (!bits[i]) continue;
      var r = Math.floor(i / 3);
      var c = i % 3;
      ctx.fillRect(
        Math.floor(offset + c * cell),
        Math.floor(offset + r * cell),
        Math.ceil(cell),
        Math.ceil(cell)
      );
    }
    return canvas;
  }

  /**
   * Erzeugt den Barcode als PNG-Blob (zum Upload oder Download)
   */
  function toBlob(value, size) {
    var canvas = drawBarcode(value, size);
    if (!canvas) return Promise.reject(new Error('Unbekannter Barcode-Wert: ' + value));
    return new Promise(function(resolve, reject) {
      canvas.toBlob(function(blob) {
        if (blob) resolve(blob); else reject(new Error('toBlob fehlgeschlagen'));
      }, 'image/png');
    });
  }

  global.ARCodes = {
    PATTERNS: PATTERNS,
    MAX_VALUE: MAX_VALUE,
    hasPattern: hasPattern,
    drawBarcode: drawBarcode,
    toBlob: toBlob
  };

})(window);
