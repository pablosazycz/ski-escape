/**
 * AdMob / Ads Manager Module
 * Integración con Google AdMob nativo via @capacitor-community/admob.
 * En navegador web (Itch.io), usa el simulador HTML integrado como fallback.
 * 
 * OPTIMIZACIÓN DE RENDIMIENTO:
 * - El banner solo se muestra en la pantalla de inicio (Menú Principal).
 * - Al pulsar "Jugar", se destruye la vista nativa de AdMob para que la GPU rinda al 100% (60 FPS).
 * - Pre-carga diferida (delayed) para no bloquear el inicio ni las animaciones.
 */

// Detectar si estamos en Capacitor nativo (APK)
const isNativeApp = typeof window !== 'undefined' && window.Capacitor !== undefined && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

// IDs Oficiales de Google AdMob
const AD_CONFIG = {
  appId: 'ca-app-pub-8709135347132669~4227148447',
  bannerId: 'ca-app-pub-8709135347132669/1600985102',
  rewardedId: 'ca-app-pub-8709135347132669/8556561684',
  interstitialId: 'ca-app-pub-8709135347132669/4625055536'
};

// ============================================================================
// NATIVE ADMOB MANAGER (APK en celular)
// ============================================================================
class NativeAdManager {
  constructor() {
    this.admob = null;
    this.initialized = false;
    this.isMenuScreen = false;
    this.isBannerShowing = false;
    this.rewardedLoaded = false;
    this.interstitialLoaded = false;
  }

  async init() {
    try {
      const module = await import('@capacitor-community/admob');
      this.admob = module.AdMob;
      this.BannerAdSize = module.BannerAdSize;
      this.BannerAdPosition = module.BannerAdPosition;
      this.RewardAdPluginEvents = module.RewardAdPluginEvents;
      this.InterstitialAdPluginEvents = module.InterstitialAdPluginEvents;
      this.AdmobConsentStatus = module.AdmobConsentStatus;

      await this.admob.initialize({
        initializeForTesting: false,
      });

      this.initialized = true;
      console.log('[AdMob Native] SDK inicializado correctamente');

      // Si el menú sigue en pantalla tras inicializar, mostrar el banner
      if (this.isMenuScreen && !this.isBannerShowing) {
        this.showBanner();
      }

      // Pre-cargar videos con delay de 3.5 segundos para no consumir CPU/red en arranque
      setTimeout(() => {
        this._preloadRewarded();
        this._preloadInterstitial();
      }, 3500);
    } catch (err) {
      console.error('[AdMob Native] Error al inicializar:', err);
    }
  }

  // --- BANNER (Exclusivo de Pantalla de Inicio / Menú Principal) ---
  async showBanner() {
    this.isMenuScreen = true;
    if (!this.initialized || !this.admob) return;
    if (this.isBannerShowing) return;

    try {
      this.isBannerShowing = true;
      await this.admob.showBanner({
        adId: AD_CONFIG.bannerId,
        adSize: this.BannerAdSize.ADAPTIVE_BANNER,
        position: this.BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
      });
      console.log('[AdMob Native] Banner mostrado en el menú principal');

      // Si el usuario ya pulsó "JUGAR" mientras el banner cargaba de la red, retirarlo de inmediato
      if (!this.isMenuScreen) {
        console.log('[AdMob Native] El usuario inició la partida mientras cargaba el banner. Retirando...');
        await this.hideBanner();
      }
    } catch (err) {
      this.isBannerShowing = false;
      console.warn('[AdMob Native] Error mostrando banner:', err);
    }
  }

  async hideBanner() {
    this.isMenuScreen = false;
    if (!this.initialized || !this.admob) return;
    try {
      await this.admob.removeBanner();
      this.isBannerShowing = false;
      console.log('[AdMob Native] Banner removido por completo (GPU 100% libre)');
    } catch (err) {
      this.isBannerShowing = false;
      console.warn('[AdMob Native] Error removiendo banner:', err);
    }
  }

  // --- REWARDED VIDEO (Para revivir o monedas gratis) ---
  async _preloadRewarded() {
    if (!this.initialized || !this.admob) return;
    try {
      await this.admob.prepareRewardVideoAd({
        adId: AD_CONFIG.rewardedId,
        isTesting: false,
      });
      this.rewardedLoaded = true;
      console.log('[AdMob Native] Rewarded precargado');
    } catch (err) {
      console.warn('[AdMob Native] Error precargando rewarded:', err);
      this.rewardedLoaded = false;
    }
  }

  async showRewarded(onReward, onClose) {
    if (!this.initialized || !this.admob) {
      if (typeof onReward === 'function') onReward();
      return;
    }

    try {
      if (!this.rewardedLoaded) {
        await this.admob.prepareRewardVideoAd({
          adId: AD_CONFIG.rewardedId,
          isTesting: false,
        });
      }

      const rewardListener = this.admob.addListener(
        this.RewardAdPluginEvents.Rewarded,
        () => {
          console.log('[AdMob Native] Recompensa otorgada');
          cleanup();
          if (typeof onReward === 'function') onReward();
          this.rewardedLoaded = false;
          setTimeout(() => this._preloadRewarded(), 2000);
        }
      );

      const dismissListener = this.admob.addListener(
        this.RewardAdPluginEvents.Dismissed,
        () => {
          console.log('[AdMob Native] Rewarded cerrado');
          cleanup();
          if (typeof onClose === 'function') onClose();
          this.rewardedLoaded = false;
          setTimeout(() => this._preloadRewarded(), 2000);
        }
      );

      const failListener = this.admob.addListener(
        this.RewardAdPluginEvents.FailedToShow,
        (err) => {
          console.warn('[AdMob Native] Rewarded falló al mostrar:', err);
          cleanup();
          if (typeof onClose === 'function') onClose();
          this.rewardedLoaded = false;
          setTimeout(() => this._preloadRewarded(), 2000);
        }
      );

      const cleanup = () => {
        rewardListener.then(l => l.remove()).catch(() => {});
        dismissListener.then(l => l.remove()).catch(() => {});
        failListener.then(l => l.remove()).catch(() => {});
      };

      await this.admob.showRewardVideoAd();
      this.rewardedLoaded = false;
    } catch (err) {
      console.warn('[AdMob Native] Error mostrando rewarded:', err);
      if (typeof onReward === 'function') onReward();
      this.rewardedLoaded = false;
      setTimeout(() => this._preloadRewarded(), 2000);
    }
  }

  // --- INTERSTITIAL (Pantalla completa al ser comido por el Yeti) ---
  async _preloadInterstitial() {
    if (!this.initialized || !this.admob) return;
    try {
      await this.admob.prepareInterstitial({
        adId: AD_CONFIG.interstitialId,
        isTesting: false,
      });
      this.interstitialLoaded = true;
      console.log('[AdMob Native] Interstitial precargado');
    } catch (err) {
      console.warn('[AdMob Native] Error precargando interstitial:', err);
      this.interstitialLoaded = false;
    }
  }

  async showInterstitial(onClose) {
    if (!this.initialized || !this.admob) {
      if (typeof onClose === 'function') onClose();
      return;
    }

    try {
      if (!this.interstitialLoaded) {
        await this.admob.prepareInterstitial({
          adId: AD_CONFIG.interstitialId,
          isTesting: false,
        });
      }

      const dismissListener = this.admob.addListener(
        this.InterstitialAdPluginEvents.Dismissed,
        () => {
          console.log('[AdMob Native] Interstitial cerrado');
          dismissListener.then(l => l.remove()).catch(() => {});
          if (typeof onClose === 'function') onClose();
          this.interstitialLoaded = false;
          setTimeout(() => this._preloadInterstitial(), 2000);
        }
      );

      const failListener = this.admob.addListener(
        this.InterstitialAdPluginEvents.FailedToShow,
        (err) => {
          console.warn('[AdMob Native] Interstitial falló:', err);
          failListener.then(l => l.remove()).catch(() => {});
          if (typeof onClose === 'function') onClose();
          this.interstitialLoaded = false;
          setTimeout(() => this._preloadInterstitial(), 2000);
        }
      );

      await this.admob.showInterstitial();
      this.interstitialLoaded = false;
    } catch (err) {
      console.warn('[AdMob Native] Error mostrando interstitial:', err);
      if (typeof onClose === 'function') onClose();
      this.interstitialLoaded = false;
      setTimeout(() => this._preloadInterstitial(), 2000);
    }
  }
}

// ============================================================================
// SIMULATED AD MANAGER (Navegador web / Itch.io)
// ============================================================================
class SimulatedAdManager {
  constructor() {
    this.isMenuScreen = false;
    this.bannerActive = false;
  }

  init() {
    console.log('[Ads Sim] Modo simulador web activo');
    const closeBannerBtn = document.getElementById('closeSimBanner');
    if (closeBannerBtn) {
      closeBannerBtn.addEventListener('click', () => this.hideBanner());
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

    typeLabel.innerText = "Anuncio Recompensado de AdMob";
    videoOverlay.classList.add('active');
    skipBtn.classList.add('disabled');
    skipBtn.disabled = true;
    skipBtn.innerText = "Omitir (Sin recompensa)";
    claimBtn.classList.add('disabled');
    claimBtn.disabled = true;
    claimBtn.innerText = "Cerrar y Revivir";

    let timeLeft = 5;
    timerLabel.innerText = `${timeLeft}s`;

    const interval = setInterval(() => {
      timeLeft--;
      timerLabel.innerText = `${timeLeft}s`;

      if (timeLeft <= 0) {
        clearInterval(interval);
        timerLabel.innerText = "¡COMPLETO!";

        claimBtn.classList.remove('disabled');
        claimBtn.disabled = false;

        skipBtn.classList.remove('disabled');
        skipBtn.disabled = false;
      }
    }, 1000);

    const handleClaim = () => {
      cleanup();
      if (typeof onReward === 'function') onReward();
    };

    const handleSkip = () => {
      cleanup();
      if (typeof onClose === 'function') onClose();
    };

    const cleanup = () => {
      videoOverlay.classList.remove('active');
      claimBtn.removeEventListener('click', handleClaim);
      skipBtn.removeEventListener('click', handleSkip);
    };

    claimBtn.addEventListener('click', handleClaim);
    skipBtn.addEventListener('click', handleSkip);
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

    typeLabel.innerText = "Anuncio Intersticial de AdMob";
    videoOverlay.classList.add('active');

    claimBtn.classList.add('disabled');
    claimBtn.disabled = true;
    claimBtn.innerText = "Cerrar";

    skipBtn.classList.add('disabled');
    skipBtn.disabled = true;

    let timeLeft = 3;
    timerLabel.innerText = `Omitir en ${timeLeft}s`;
    skipBtn.innerText = "Omitir anuncio";

    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        timerLabel.innerText = `Omitir en ${timeLeft}s`;
      } else {
        clearInterval(interval);
        timerLabel.innerText = "Listo";
        skipBtn.classList.remove('disabled');
        skipBtn.disabled = false;
        skipBtn.innerText = "Cerrar Anuncio";
      }
    }, 1000);

    const handleSkip = () => {
      videoOverlay.classList.remove('active');
      skipBtn.removeEventListener('click', handleSkip);
      if (typeof onClose === 'function') onClose();
    };

    skipBtn.addEventListener('click', handleSkip);
  }
}

// ============================================================================
// FACTORY: Elegir implementación según plataforma
// ============================================================================
let ads;

if (isNativeApp) {
  console.log('[Ads] Detectado entorno nativo (APK). Usando AdMob real optimizado.');
  ads = new NativeAdManager();
  ads.init();
} else {
  console.log('[Ads] Detectado entorno web. Usando simulador.');
  ads = new SimulatedAdManager();
  ads.init();
}

export { ads };
window.AdManager = ads;
