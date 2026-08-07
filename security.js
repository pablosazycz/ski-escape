/**
 * Security & Data Integrity Module
 * Garantiza el almacenamiento seguro de datos del jugador (monedas, skins, logros)
 * utilizando encriptación liviana y validación por checksum anti-trucos (Anti-Cheat).
 * También incluye funciones de sanitización de texto para prevenir ataques XSS.
 */

class SecurityManager {
  constructor() {
    this.SECRET_SALT = 'SkiEscape_GooglePlay_Sec_2026';
  }

  // Genera un hash numérico simple (Checksum) a partir de un string
  generateChecksum(str) {
    let hash = 0;
    const combined = str + this.SECRET_SALT;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convertir a entero 32bit
    }
    return Math.abs(hash).toString(16);
  }

  // Guarda un objeto de estado seguro en localStorage
  saveSecureData(key, dataObj) {
    try {
      const jsonStr = JSON.stringify(dataObj);
      const checksum = this.generateChecksum(jsonStr);
      const payload = {
        data: btoa(unescape(encodeURIComponent(jsonStr))), // Base64 encoding
        sig: checksum
      };
      localStorage.setItem(`ski_sec_${key}`, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error("[Security] Error al guardar datos seguros:", e);
      return false;
    }
  }

  // Carga un objeto de estado y valida la firma (Checksum) anti-trucos
  loadSecureData(key, defaultObj) {
    try {
      const rawPayload = localStorage.getItem(`ski_sec_${key}`);
      if (!rawPayload) return defaultObj;

      const payload = JSON.parse(rawPayload);
      if (!payload.data || !payload.sig) return defaultObj;

      // Decodificar Base64
      const jsonStr = decodeURIComponent(escape(atob(payload.data)));
      
      // Verificar si la firma coincide
      const expectedChecksum = this.generateChecksum(jsonStr);
      if (payload.sig !== expectedChecksum) {
        console.warn(`[Security Anti-Cheat] ⚠️ Intento de alteración detectado en key '${key}'. Restaurando estado seguro por defecto.`);
        return defaultObj;
      }

      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("[Security] Error al cargar datos seguros o datos corruptos:", e);
      return defaultObj;
    }
  }

  // Sanitización estricta de textos contra XSS
  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const security = new SecurityManager();
window.SecurityManager = security;
