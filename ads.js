/**
 * AdMob / Ads Manager Module
 * Integración 100% REAL con Google AdMob vía @capacitor-community/admob.
 * 
 * POLÍTICA DE RENDIMIENTO Y MONETIZACIÓN:
 * 1. En la app nativa (APK celular) SOLO se usan los bloques de anuncios oficiales de producción.
 *    NO hay anuncios de prueba ni simuladores falsos que no generen ingresos.
 * 2. Pre-carga continua y reintentos automáticos en segundo plano:
 *    Si Google tarda en responder o no tiene inventario en ese instante, el sistema
 *    sigue solicitando periódicamente hasta tener el anuncio real listo en memoria.
 * 3. Si el jugador solicita un video y aún no terminó de cargar, se muestra un aviso
 *    elegante en pantalla ("Cargando anuncio de Google...") mientras se conecta y lo lanza.
 * 4. Si el anuncio real no puede mostrarse por falta de red, NO se regalan recompensas.
 * 5. En navegador web de escritorio (Itch.io), donde no existe AdMob nativo, corre
 *    el simulador HTML exclusivamente para pruebas web.
 */

import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  RewardAdPluginEvents,
  InterstitialAdPluginEvents
} from '@capacitor-community/admob';

// Detectar si estamos en Capacitor nativo (APK Android / iOS)
const isNativeApp = typeof window !== 'undefined' && Capacitor.isNativePlatform();

// IDs Oficiales de Producción de Google AdMob
const AD_CONFIG = {
  appId: 'ca-app-pub-8709135347132669~4227148447',
  bannerId: 'ca-app-pub-8709135347132669/1600985102',
  rewardedId: 'ca-app-pub-8709135347132669/8556561684',
  interstitialId: 'ca-app-pub-8709135347132669/4625055536'
};

// Utilidad de aviso flotante visual para el usuario
function showAdToast(text, duration = 3000) {
  try {
    let toast = document.getElementById('adMobToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adMobToast';
      toast.className = 'ad-mob-toast';
      document.body.appendChild(toast);
    }
    toast.innerText = text;
    toast.classList.add('visible');
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  } catch (e) {
    console.log('[Ad Toast]', text);
  }
}

// ============================================================================
// NATIVE ADMOB MANAGER (100% Real - Genera Ingresos / eCPM)
// ============================================================================
class NativeAdManager {
  constructor() {
    this.initialized = false;
    this.isMenuScreen = false;
    this.isBannerShowing = false;
    this.rewardedLoaded = false;
    this.rewardedLoading = false;
    this.interstitialLoaded = false;
    this.interstitialLoading = false;
    this._bannerRetryTimeout = null;
    this._rewardedRetryTimeout = null;
    this._interstitialRetryTimeout = null;
  }

  async init() {
    try {
      console.log('[AdMob Real] Inicializando SDK oficial de Google AdMob...');
      await AdMob.initialize({
        initializeForTesting: false,
      });

      this.initialized = true;
      console.log('[AdMob Real] SDK de Google AdMob inicializado con éxito');

      // Si el menú principal ya está visible al terminar de iniciar, solicitar banner
      if (this.isMenuScreen && !this.isBannerShowing) {
        this.showBanner();
      }

      // Iniciar precargas continuas de videos en segundo plano
      setTimeout(() => {
        this._preloadRewarded();
        this._preloadInterstitial();
      }, 2000);
    } catch (err) {
      console.error('[AdMob Real] Error inicializando SDK de Google AdMob:', err);
    }
  }

  // --- BANNER OFICIAL (Menú Principal) ---
  async showBanner() {
    this.isMenuScreen = true;
    if (this.isBannerShowing) return;

    if (!this.initialized) {
      return;
    }

    try {
      this.isBannerShowing = true;
      console.log('[AdMob Real] Cargando banner oficial...');
      await AdMob.showBanner({
        adId: AD_CONFIG.bannerId,
        isTesting: false,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
      });
      console.log('[AdMob Real] Banner oficial activo en el menú');
    } catch (err) {
      this.isBannerShowing = false;
      console.warn('[AdMob Real] Banner no disponible en este momento. Reintentando en 10s:', err);

      // Redireccionamiento / Reintento periódico para que aparezca en cuanto haya inventario
      if (this._bannerRetryTimeout) clearTimeout(this._bannerRetryTimeout);
      this._bannerRetryTimeout = setTimeout(() => {
        if (this.isMenuScreen && !this.isBannerShowing) {
          this.showBanner();
        }
      }, 10000);
    }

    // Si el usuario ya pulsó "JUGAR" mientras el banner cargaba de la red, retirarlo de inmediato
    if (!this.isMenuScreen) {
      await this.hideBanner();
    }
  }

  async hideBanner() {
    this.isMenuScreen = false;
    if (this._bannerRetryTimeout) {
      clearTimeout(this._bannerRetryTimeout);
      this._bannerRetryTimeout = null;
    }
    if (!this.initialized) return;

    try {
      await AdMob.removeBanner();
      console.log('[AdMob Real] Banner removido para juego a 60 FPS');
    } catch (err) {
      console.warn('[AdMob Real] Error al remover banner:', err);
    } finally {
      this.isBannerShowing = false;
    }
  }

  // --- REWARDED VIDEO OFICIAL (Precarga continua y reintentos) ---
  async _preloadRewarded() {
    if (!this.initialized || this.rewardedLoading || this.rewardedLoaded) return;
    this.rewardedLoading = true;

    if (this._rewardedRetryTimeout) {
      clearTimeout(this._rewardedRetryTimeout);
      this._rewardedRetryTimeout = null;
    }

    try {
      console.log('[AdMob Real] Precargando video recompensado oficial de Google...');
      await AdMob.prepareRewardVideoAd({
        adId: AD_CONFIG.rewardedId,
        isTesting: false,
      });
      this.rewardedLoaded = true;
      this.rewardedLoading = false;
      console.log('[AdMob Real] ✅ Video recompensado oficial 100% listo en memoria');
    } catch (err) {
      this.rewardedLoaded = false;
      this.rewardedLoading = false;
      console.warn('[AdMob Real] Google no entregó video en este intento. Reintentando en 8 segundos...', err);
      // Mantener bucle de reintento activo para tener siempre un anuncio listo
      this._rewardedRetryTimeout = setTimeout(() => {
        if (!this.rewardedLoaded) {
          this._preloadRewarded();
        }
      }, 8000);
    }
  }

  async showRewarded(onReward, onClose) {
    if (!this.initialized) {
      showAdToast('⏳ Conectando con Google AdMob...');
      if (typeof onClose === 'function') onClose();
      return;
    }

    // Si no está listo en memoria, intentar carga activa con espera visual
    if (!this.rewardedLoaded) {
      showAdToast('⏳ Cargando anuncio de Google...', 4000);
      console.log('[AdMob Real] Video no estaba precargado. Intentando carga activa rápida...');
      try {
        await Promise.race([
          this._preloadRewardedDirect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de carga')), 7000))
        ]);
      } catch (loadErr) {
        console.warn('[AdMob Real] No se pudo cargar el video tras reintento activo:', loadErr);
      }
    }

    // Si aún así no hay anuncio disponible de Google:
    if (!this.rewardedLoaded) {
      showAdToast('⚠️ Anuncio no disponible aún. Intenta de nuevo en unos segundos.', 3500);
      console.warn('[AdMob Real] Sin anuncio disponible. NO se otorga recompensa sin ver el anuncio.');
      if (typeof onClose === 'function') onClose();
      // Reanudar precarga inmediatamente en segundo plano
      this._preloadRewarded();
      return;
    }

    // Si tenemos el anuncio real listo, mostrarlo y registrar la recompensa
    try {
      let earnedReward = false;
      let handled = false;

      const finish = (isReward) => {
        if (handled) return;
        handled = true;
        this.rewardedLoaded = false;
        cleanup();
        // Iniciar precarga inmediata del siguiente anuncio
        setTimeout(() => this._preloadRewarded(), 2000);

        if (isReward) {
          if (typeof onReward === 'function') onReward();
        } else {
          if (typeof onClose === 'function') onClose();
        }
      };

      const rewardSub = AdMob.addListener(
        RewardAdPluginEvents.Rewarded,
        (rewardItem) => {
          console.log('[AdMob Real] Recompensa confirmada por Google AdMob:', rewardItem);
          earnedReward = true;
        }
      );

      const dismissSub = AdMob.addListener(
        RewardAdPluginEvents.Dismissed,
        () => {
          console.log('[AdMob Real] Video recompensado cerrado. earnedReward =', earnedReward);
          finish(earnedReward);
        }
      );

      const failSub = AdMob.addListener(
        RewardAdPluginEvents.FailedToShow,
        (err) => {
          console.warn('[AdMob Real] Error al reproducir video:', err);
          cleanup();
          this.rewardedLoaded = false;
          showAdToast('⚠️ Error al reproducir anuncio de Google.', 3000);
          finish(false);
          setTimeout(() => this._preloadRewarded(), 2000);
        }
      );

      const cleanup = () => {
        rewardSub.then(l => l.remove()).catch(() => {});
        dismissSub.then(l => l.remove()).catch(() => {});
        failSub.then(l => l.remove()).catch(() => {});
      };

      await AdMob.showRewardVideoAd();
    } catch (err) {
      console.warn('[AdMob Real] Excepción en showRewardVideoAd:', err);
      this.rewardedLoaded = false;
      showAdToast('⚠️ No se pudo reproducir el anuncio.', 3000);
      if (typeof onClose === 'function') onClose();
      setTimeout(() => this._preloadRewarded(), 2000);
    }
  }

  async _preloadRewardedDirect() {
    this.rewardedLoading = true;
    try {
      await AdMob.prepareRewardVideoAd({
        adId: AD_CONFIG.rewardedId,
        isTesting: false,
      });
      this.rewardedLoaded = true;
      this.rewardedLoading = false;
      return true;
    } catch (err) {
      this.rewardedLoaded = false;
      this.rewardedLoading = false;
      throw err;
    }
  }

  // --- INTERSTITIAL OFICIAL (Al ser comido por el Yeti) ---
  async _preloadInterstitial() {
    if (!this.initialized || this.interstitialLoading || this.interstitialLoaded) return;
    this.interstitialLoading = true;

    if (this._interstitialRetryTimeout) {
      clearTimeout(this._interstitialRetryTimeout);
      this._interstitialRetryTimeout = null;
    }

    try {
      console.log('[AdMob Real] Precargando anuncio intersticial oficial...');
      await AdMob.prepareInterstitial({
        adId: AD_CONFIG.interstitialId,
        isTesting: false,
      });
      this.interstitialLoaded = true;
      this.interstitialLoading = false;
      console.log('[AdMob Real] ✅ Intersticial oficial listo en memoria');
    } catch (err) {
      this.interstitialLoaded = false;
      this.interstitialLoading = false;
      console.warn('[AdMob Real] Intersticial no disponible ahora. Reintentando en 10 segundos...', err);
      this._interstitialRetryTimeout = setTimeout(() => {
        if (!this.interstitialLoaded) {
          this._preloadInterstitial();
        }
      }, 10000);
    }
  }

  async showInterstitial(onClose) {
    if (!this.initialized) {
      if (typeof onClose === 'function') onClose();
      return;
    }

    if (!this.interstitialLoaded) {
      console.log('[AdMob Real] Intersticial no precargado en este instante. Intentando preparar...');
      try {
        await AdMob.prepareInterstitial({
          adId: AD_CONFIG.interstitialId,
          isTesting: false,
        });
        this.interstitialLoaded = true;
      } catch (loadErr) {
        console.warn('[AdMob Real] No se pudo cargar intersticial en tiempo real:', loadErr);
        if (typeof onClose === 'function') onClose();
        this._preloadInterstitial();
        return;
      }
    }

    try {
      let handled = false;
      const finish = () => {
        if (handled) return;
        handled = true;
        this.interstitialLoaded = false;
        cleanup();
        setTimeout(() => this._preloadInterstitial(), 2000);
        if (typeof onClose === 'function') onClose();
      };

      const dismissSub = AdMob.addListener(
        InterstitialAdPluginEvents.Dismissed,
        () => {
          console.log('[AdMob Real] Intersticial cerrado');
          finish();
        }
      );

      const failSub = AdMob.addListener(
        InterstitialAdPluginEvents.FailedToShow,
        (err) => {
          console.warn('[AdMob Real] Interstitial falló al mostrar:', err);
          cleanup();
          this.interstitialLoaded = false;
          finish();
          setTimeout(() => this._preloadInterstitial(), 2000);
        }
      );

      const cleanup = () => {
        dismissSub.then(l => l.remove()).catch(() => {});
        failSub.then(l => l.remove()).catch(() => {});
      };

      await AdMob.showInterstitial();
    } catch (err) {
      console.warn('[AdMob Real] Error mostrando intersticial:', err);
      this.interstitialLoaded = false;
      if (typeof onClose === 'function') onClose();
      setTimeout(() => this._preloadInterstitial(), 2000);
    }
  }
}

// ============================================================================
// SIMULATED AD MANAGER (Únicamente para navegador Web de PC / Itch.io)
// ============================================================================
class SimulatedAdManager {
  constructor() {
    this.isMenuScreen = false;
    this.bannerActive = false;
    this._activeInterval = null;
  }

  init() {
    console.log('[Ads Web] Entorno web de escritorio detectado (Modo simulador para pruebas locales/itch.io)');
    const closeBannerBtn = document.getElementById('closeSimBanner');
    if (closeBannerBtn) {
      closeBannerBtn.onclick = () => this.hideBanner();
    }
  }

  showBanner() {
    this.isMenuScreen = true;
    const banner = document.getElementById('simulatedBannerAd');
    if (banner) {
      banner.classList.add('active');
      this.bannerActive = true;
    }
  }

  hideBanner() {
    this.isMenuScreen = false;
    const banner = document.getElementById('simulatedBannerAd');
    if (banner) {
      banner.classList.remove('active');
      this.bannerActive = false;
    }
  }

  showRewarded(onReward, onClose) {
    const videoOverlay = document.getElementById('simulatedVideoAd');
    const timerLabel = document.getElementById('simVideoTimer');
    const typeLabel = document.getElementById('simVideoTypeLabel');
    const skipBtn = document.getElementById('skipSimVideoBtn');
    const claimBtn = document.getElementById('claimRewardBtn');

    if (!videoOverlay) {
      if (typeof onReward === 'function') onReward();
      return;
    }

    if (this._activeInterval) {
      clearInterval(this._activeInterval);
      this._activeInterval = null;
    }

    typeLabel.innerText = "Simulador Web de Publicidad";
    videoOverlay.classList.add('active');
    skipBtn.classList.add('disabled');
    skipBtn.disabled = true;
    skipBtn.innerText = "Omitir (Sin recompensa)";
    claimBtn.classList.add('disabled');
    claimBtn.disabled = true;
    claimBtn.innerText = "Cerrar y Reclamar";

    let timeLeft = 5;
    timerLabel.innerText = `${timeLeft}s`;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (this._activeInterval) {
        clearInterval(this._activeInterval);
        this._activeInterval = null;
      }
      videoOverlay.classList.remove('active');
      claimBtn.onclick = null;
      skipBtn.onclick = null;
    };

    this._activeInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        timerLabel.innerText = `${timeLeft}s`;
      } else {
        clearInterval(this._activeInterval);
        this._activeInterval = null;
        timerLabel.innerText = "¡COMPLETO!";

        claimBtn.classList.remove('disabled');
        claimBtn.disabled = false;

        skipBtn.classList.remove('disabled');
        skipBtn.disabled = false;
      }
    }, 1000);

    claimBtn.onclick = () => {
      cleanup();
      if (typeof onReward === 'function') onReward();
    };

    skipBtn.onclick = () => {
      cleanup();
      if (typeof onClose === 'function') onClose();
    };
  }

  showInterstitial(onClose) {
    const videoOverlay = document.getElementById('simulatedVideoAd');
    const timerLabel = document.getElementById('simVideoTimer');
    const typeLabel = document.getElementById('simVideoTypeLabel');
    const skipBtn = document.getElementById('skipSimVideoBtn');
    const claimBtn = document.getElementById('claimRewardBtn');

    if (!videoOverlay) {
      if (typeof onClose === 'function') onClose();
      return;
    }

    if (this._activeInterval) {
      clearInterval(this._activeInterval);
      this._activeInterval = null;
    }

    typeLabel.innerText = "Simulador Web de Intersticial";
    videoOverlay.classList.add('active');

    claimBtn.classList.add('disabled');
    claimBtn.disabled = true;
    claimBtn.innerText = "Cerrar";

    skipBtn.classList.add('disabled');
    skipBtn.disabled = true;

    let timeLeft = 3;
    timerLabel.innerText = `Omitir en ${timeLeft}s`;
    skipBtn.innerText = "Omitir anuncio";

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (this._activeInterval) {
        clearInterval(this._activeInterval);
        this._activeInterval = null;
      }
      videoOverlay.classList.remove('active');
      skipBtn.onclick = null;
      claimBtn.onclick = null;
    };

    this._activeInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        timerLabel.innerText = `Omitir en ${timeLeft}s`;
      } else {
        clearInterval(this._activeInterval);
        this._activeInterval = null;
        timerLabel.innerText = "Listo";
        skipBtn.classList.remove('disabled');
        skipBtn.disabled = false;
        skipBtn.innerText = "Cerrar Anuncio";
      }
    }, 1000);

    skipBtn.onclick = () => {
      cleanup();
      if (typeof onClose === 'function') onClose();
    };

    claimBtn.onclick = () => {
      cleanup();
      if (typeof onClose === 'function') onClose();
    };
  }
}

// ============================================================================
// FACTORY: Selección estricta de plataforma
// ============================================================================
let ads;

if (isNativeApp) {
  console.log('[Ads] Dispositivo nativo (APK). Activando AdMob 100% REAL de producción.');
  ads = new NativeAdManager();
  ads.init();
} else {
  console.log('[Ads] Navegador web detectado.');
  ads = new SimulatedAdManager();
  ads.init();
}

export { ads };
window.AdManager = ads;
