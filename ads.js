/**
 * AdMob / Ads Manager Module
 * Maneja la publicidad visual en la aplicación. Si el plugin nativo de AdMob
 * no está presente en el APK, utiliza el simulador visual integrado para que
 * siempre se muestren los banners y videos en pantalla.
 */

class AdManager {
  constructor() {
    this.isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;
    this.bannerActive = false;
    this.hasRewardedReward = false;

    // Configuración de IDs Oficiales de Google AdMob
    this.adMobConfig = {
      appId: 'ca-app-pub-8709135347132669~4227148447',
      bannerId: 'ca-app-pub-8709135347132669/1600985102',
      rewardedId: 'ca-app-pub-8709135347132669/8556561684',
      interstitialId: 'ca-app-pub-8709135347132669/4625055536'
    };
  }

  init() {
    console.log(`[Ads] Inicializando gestor de anuncios. Entorno: ${this.isCapacitor ? 'Capacitor Mobile' : 'Navegador'}`);
    this.setupSimulatorEvents();
  }

  setupSimulatorEvents() {
    const closeBannerBtn = document.getElementById('closeSimBanner');
    if (closeBannerBtn) {
      closeBannerBtn.addEventListener('click', () => this.hideBanner());
    }
  }

  // --- BANNER AD ---
  showBanner() {
    const banner = document.getElementById('simulatedBannerAd');
    if (banner) {
      banner.classList.add('active');
      this.bannerActive = true;
      console.log('[Ads] Banner de anuncios mostrado');
    }
  }

  hideBanner() {
    const banner = document.getElementById('simulatedBannerAd');
    if (banner) {
      banner.classList.remove('active');
      this.bannerActive = false;
      console.log('[Ads] Banner ocultado');
    }
  }

  // --- REWARDED AD (Video Recompensado para Revivir) ---
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
      console.log('[Ads] Video visto completo. Otorgando recompensa (Revivir)');
      if (typeof onReward === 'function') onReward();
    };

    const handleSkip = () => {
      cleanup();
      console.log('[Ads] Anuncio omitido.');
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

  // --- INTERSTITIAL AD (Anuncio Pantalla Completa) ---
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
      console.log('[Ads] Anuncio intersticial cerrado.');
      if (typeof onClose === 'function') onClose();
    };

    skipBtn.addEventListener('click', handleSkip);
  }
}

export const ads = new AdManager();
ads.init();
window.AdManager = ads;
