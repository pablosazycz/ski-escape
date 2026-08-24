import { ads } from './ads.js';
import { sound } from './sound.js';
import { security } from './security.js';
import { t, getLanguage, setLanguage, toggleLanguage, applyTranslations } from './i18n.js';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// ==========================================================================
// VIBRACIÓN HÁPTICA PARA CELULAR (CON FALLBACK WEB)
// ==========================================================================
async function triggerHaptic(type = 'light') {
  try {
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (type === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (type === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    }
  } catch (e) {
    if (navigator.vibrate) {
      if (type === 'light') navigator.vibrate(12);
      else if (type === 'medium') navigator.vibrate(28);
      else if (type === 'heavy') navigator.vibrate(65);
      else if (type === 'success') navigator.vibrate([20, 35, 20]);
    }
  }
}

// ==========================================================================
// CONFIGURACIÓN Y ESTADOS DEL JUEGO
// ==========================================================================
const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  JUMPING: 'JUMPING',
  PAUSED: 'PAUSED',
  CRASHED: 'CRASHED',
  EATEN: 'EATEN',
  GAMEOVER: 'GAMEOVER'
};

let gameState = STATES.START;

// Exponer a window para que sound.js pueda leerlo
window.gameState = gameState;

// Selección de elementos del DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const splashScreen = document.getElementById('splashScreen');
const mainMenu = document.getElementById('mainMenu');
const instructionsPanel = document.getElementById('instructionsPanel');
const privacyModal = document.getElementById('privacyModal');
const gameHUD = document.getElementById('gameHUD');
const gameOverMenu = document.getElementById('gameOverMenu');
const pauseMenu = document.getElementById('pauseMenu');
const shopModal = document.getElementById('shopModal');
const yetiWarning = document.getElementById('yetiWarning');
const yetiTerrorOverlay = document.getElementById('yetiTerrorOverlay');

let cameraShakeY = 0;
const speedVal = document.getElementById('speedVal');
const highScoreVal = document.getElementById('highScoreVal');
const finalScoreVal = document.getElementById('finalScoreVal');
const currentRecordVal = document.getElementById('currentRecordVal');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverReason = document.getElementById('gameOverReason');
const yetiDistanceLabel = document.getElementById('yetiDistanceLabel');

const menuCoinsVal = document.getElementById('menuCoinsVal');
const hudCoinsVal = document.getElementById('hudCoinsVal');
const shopCoinsVal = document.getElementById('shopCoinsVal');
const shieldBadge = document.getElementById('shieldBadge');
const magnetBadge = document.getElementById('magnetBadge');
const magnetTimerLabel = document.getElementById('magnetTimer');

// Botones
const playBtn = document.getElementById('playBtn');
const shopBtn = document.getElementById('shopBtn');
const closeShopBtn = document.getElementById('closeShopBtn');
const freeCoinsAdBtn = document.getElementById('freeCoinsAdBtn');
const howToBtn = document.getElementById('howToBtn');
const closeInstBtn = document.getElementById('closeInstBtn');
const privacyBtn = document.getElementById('privacyBtn');
const closePrivacyBtn = document.getElementById('closePrivacyBtn');
const reviveBtn = document.getElementById('reviveBtn');
const restartBtn = document.getElementById('restartBtn');
const mainMenuBtn = document.getElementById('mainMenuBtn');

// Botones del Menú de Pausa
const resumeBtn = document.getElementById('resumeBtn');
const pauseMuteBtn = document.getElementById('pauseMuteBtn');
const restartPauseBtn = document.getElementById('restartPauseBtn');
const mainMenuPauseBtn = document.getElementById('mainMenuPauseBtn');

// Selectores de Personaje y Dificultad
const charSkierBtn = document.getElementById('charSkierBtn');
const charBoarderBtn = document.getElementById('charBoarderBtn');

const styleBananaBtn = document.getElementById('styleBananaBtn');
const styleHumanBtn = document.getElementById('styleHumanBtn');

const diffEasyBtn = document.getElementById('diffEasyBtn');
const diffMedBtn = document.getElementById('diffMedBtn');
const diffHardBtn = document.getElementById('diffHardBtn');

const DIFFICULTIES = {
  EASY: { name: 'FÁCIL', baseSpeed: 3.2, speedDiv: 6000, obsStep: 65, mult: 1.0 },
  MEDIUM: { name: 'MEDIO', baseSpeed: 4.0, speedDiv: 4500, obsStep: 45, mult: 1.2 },
  HARD: { name: 'DIFÍCIL', baseSpeed: 5.2, speedDiv: 2800, obsStep: 30, mult: 1.5 }
};

let currentDiff = DIFFICULTIES.MEDIUM;
let selectedChar = 'SKIER'; // 'SKIER' o 'BOARDER'
let selectedStyle = 'BANANA'; // 'BANANA' o 'HUMAN'
let selectedYetiThreshold = 1500; // Distancia de aparición del Yeti (500m, 1500m, 2500m o Off)

// Registradores de selección de Yeti Distance con Delegación Global
document.addEventListener('click', (e) => {
  const yetiBtn = e.target.closest('.yeti-dist-btn');
  if (yetiBtn) {
    document.querySelectorAll('.yeti-dist-btn').forEach(b => b.classList.remove('active'));
    yetiBtn.classList.add('active');
    selectedYetiThreshold = parseInt(yetiBtn.getAttribute('data-yeti') || '1500');
  }
});

// Detección global de dispositivo móvil (se usa para optimizar rendimiento)
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const MAX_SKI_TRACKS = isMobile ? 150 : 400;
const MAX_PARTICLES = isMobile ? 60 : 200;
let _trackFrameSkip = 0; // Throttle de tracks en mobile

// Configuración de resolución responsiva
let width = canvas.clientWidth;
let height = canvas.clientHeight;

function resizeCanvas() {
  const container = document.getElementById('gameContainer');
  width = container.clientWidth;
  height = container.clientHeight;
  // isMobile ya definido como constante global
  const maxDpr = isMobile ? 1.0 : 2.0;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr); // Optimizado para no reventar la GPU de celulares
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==========================================================================
// VARIABLES DE JUEGO
// ==========================================================================
let score = 0;
let highScore = parseInt(localStorage.getItem('ski_escape_highscore')) || 0;
highScoreVal.innerText = `${highScore}m`;

// Carga segura del perfil del jugador (Anti-Cheat Base64 + Checksum)
let playerProfile = security.loadSecureData('player_profile', {
  coins: 0,
  unlockedSkins: ['default'],
  activeSkin: 'default',
  quests: [
    { id: 'jumps_3', title: '🎿 Realiza 3 saltos 360 en rampas', target: 3, current: 0, reward: 25, completed: false, claimed: false },
    { id: 'coins_15', title: '🪙 Recoge 15 monedas doradas', target: 15, current: 0, reward: 20, completed: false, claimed: false },
    { id: 'close_5', title: '🔥 Consigue 5 Roce Rasante (Close Calls)', target: 5, current: 0, reward: 30, completed: false, claimed: false }
  ]
});

function saveProfile() {
  security.saveSecureData('player_profile', playerProfile);
  updateCoinsUI();
}

function updateCoinsUI() {
  const mVal = document.getElementById('menuCoinsVal');
  const hVal = document.getElementById('hudCoinsVal');
  const sVal = document.getElementById('shopCoinsVal');
  if (mVal) mVal.innerText = `${playerProfile.coins}`;
  if (hVal) hVal.innerText = `${playerProfile.coins}`;
  if (sVal) sVal.innerText = `${playerProfile.coins}`;
}
updateCoinsUI();

// --- GESTOR DE MISIONES Y LOGROS ---
function getQuests() {
  if (!playerProfile.quests || !Array.isArray(playerProfile.quests) || playerProfile.quests.length === 0) {
    playerProfile.quests = [
      { id: 'jumps_3', title: '🎿 Realiza 3 saltos 360 en rampas', target: 3, current: 0, reward: 25, completed: false, claimed: false },
      { id: 'coins_15', title: '🪙 Recoge 15 monedas doradas', target: 15, current: 0, reward: 20, completed: false, claimed: false },
      { id: 'close_5', title: '🔥 Consigue 5 Roce Rasante (Close Calls)', target: 5, current: 0, reward: 30, completed: false, claimed: false }
    ];
    saveProfile();
  }
  return playerProfile.quests;
}

function updateQuestProgress(questId, amount = 1) {
  const quests = getQuests();
  const q = quests.find(item => item.id === questId);
  if (q && !q.completed) {
    q.current = Math.min(q.target, (q.current || 0) + amount);
    if (q.current >= q.target) {
      q.completed = true;
      spawnFloatingText(player.x, player.y - 50, t('quest_complete_text'), '#fbbf24', 15);
      sound.playReward();
      triggerHaptic('success');
    }
    saveProfile();
  }
}

function renderQuestsUI() {
  const questsList = document.getElementById('questsList');
  if (!questsList) return;
  questsList.innerHTML = '';
  const quests = getQuests();
  quests.forEach(q => {
    const card = document.createElement('div');
    card.className = `quest-card ${q.completed ? 'completed' : ''}`;
    const pct = Math.min(100, Math.round(((q.current || 0) / q.target) * 100));

    let qTitle = q.title;
    if (q.id === 'jumps_3') qTitle = t('quest_jumps');
    else if (q.id === 'coins_15') qTitle = t('quest_coins');
    else if (q.id === 'close_5') qTitle = t('quest_close');

    const qRewardLabel = t('quest_reward_label');
    const claimText = t('quest_claim');
    const claimedText = t('quest_claimed');
    
    card.innerHTML = `
      <div class="quest-info">
        <span class="quest-title">${qTitle}</span>
        <span class="quest-reward">+${q.reward} 🪙 ${qRewardLabel} (${q.current || 0}/${q.target})</span>
        <div class="quest-progress-wrap">
          <div class="quest-progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
      <div>
        ${q.claimed 
          ? `<span class="text-muted" style="font-size:0.75rem; font-weight:700;">${claimedText}</span>` 
          : (q.completed 
              ? `<button class="btn btn-reward quest-claim-btn" data-qid="${q.id}">${claimText}</button>` 
              : `<span class="text-muted" style="font-size:0.75rem;">${pct}%</span>`)}
      </div>
    `;
    questsList.appendChild(card);
  });
}

document.addEventListener('click', (e) => {
  const qBtn = e.target.closest('#questsBtn');
  if (qBtn) {
    try { sound.init(); } catch (err) {}
    sound.playClick();
    renderQuestsUI();
    const modal = document.getElementById('questsModal');
    if (modal) modal.classList.add('active');
    return;
  }

  const closeQBtn = e.target.closest('#closeQuestsBtn');
  if (closeQBtn) {
    sound.playClick();
    const modal = document.getElementById('questsModal');
    if (modal) modal.classList.remove('active');
    return;
  }

  const claimBtn = e.target.closest('.quest-claim-btn');
  if (claimBtn) {
    const qid = claimBtn.getAttribute('data-qid');
    const quests = getQuests();
    const q = quests.find(item => item.id === qid);
    if (q && q.completed && !q.claimed) {
      q.claimed = true;
      playerProfile.coins += q.reward;
      saveProfile();
      sound.playReward();
      triggerHaptic('success');
      spawnConfetti();
      renderQuestsUI();
    }
  }
});

function updatePowerUpBadges() {
  if (shieldBadge) {
    if (player.hasShield) {
      shieldBadge.classList.add('active');
    } else {
      shieldBadge.classList.remove('active');
    }
  }
  if (magnetBadge) {
    if (player.hasMagnet) {
      magnetBadge.classList.add('active');
      if (magnetTimerLabel) {
        magnetTimerLabel.innerText = Math.ceil(player.magnetTimer / 60);
      }
    } else {
      magnetBadge.classList.remove('active');
    }
  }
}

let player = {
  x: width / 2,
  y: 100,
  width: 24,
  height: 32,
  speedX: 0,
  speedY: 4,
  maxSpeedX: 5,
  baseSpeedY: 4,
  maxSpeedY: 10,
  angle: 0, // Inclinación visual al girar
  jumpAirTime: 0, // Tiempo transcurrido en el aire
  jumpDuration: 40, // Duración total del salto en frames
  jumpScale: 1, // Escala de tamaño para simular altura en salto
  hasRevived: false,
  crashCooldown: 0,
  isTurbo: false,
  turboTimer: 0,
  hasShield: false,
  hasMagnet: false,
  magnetTimer: 0
};

let yeti = {
  x: width / 2,
  y: -200,
  width: 60,
  height: 72,
  speedY: 0,
  easeX: 0.04,
  isStunned: false,
  stunTimer: 0,
  active: false,
  animFrame: 0,
  eatingTimer: 0
};

let obstacles = [];
let skiTracks = [];
let particles = [];
let floatingTexts = [];
let keys = {};
let touchTargetX = null;
let smoothedCameraY = 0;

// Carga de Sprites de Alta Definición
const skierImg = new Image();
skierImg.src = './skier_sprite.jpg';

const boarderImg = new Image();
boarderImg.src = './snowboarder_sprite.jpg';

const yetiImg = new Image();
yetiImg.src = './yeti_sprite.jpg';

// Función para hacer transparente el fondo blanco de los sprites
function makeImageTransparent(img) {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth || img.width;
    tempCanvas.height = img.naturalHeight || img.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;
    
    const tolerance = 35; 
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 255 - tolerance && data[i+1] > 255 - tolerance && data[i+2] > 255 - tolerance) {
        data[i+3] = 0;
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    
    const newImg = new Image();
    newImg.src = tempCanvas.toDataURL('image/png');
    return newImg;
  } catch (e) {
    console.warn("No se pudo aplicar transparencia dinámica al sprite:", e);
    return img;
  }
}

// Sprites Retro Pixel Art - Esquiadores (Human y Banana)
let retroBananaSkierImg = new Image();
retroBananaSkierImg.src = './banana_skier_retro_sprites.png';
retroBananaSkierImg.onload = () => {
  retroBananaSkierImg = makeImageTransparent(retroBananaSkierImg);
};

let retroHumanSkierImg = new Image();
retroHumanSkierImg.src = './skier_retro_sprites.png';
retroHumanSkierImg.onload = () => {
  retroHumanSkierImg = makeImageTransparent(retroHumanSkierImg);
};

// Sprites Retro Pixel Art - Snowboarders (3 Poses 100% individuales e independientes)
const humanBoarderLeftImg = new Image();
humanBoarderLeftImg.src = './human_boarder_left.png';

const humanBoarderDownImg = new Image();
humanBoarderDownImg.src = './human_boarder_down.png';

const humanBoarderRightImg = new Image();
humanBoarderRightImg.src = './human_boarder_right.png';

const bananaBoarderLeftImg = new Image();
bananaBoarderLeftImg.src = './banana_boarder_left.png';

const bananaBoarderDownImg = new Image();
bananaBoarderDownImg.src = './banana_boarder_down.png';

const bananaBoarderRightImg = new Image();
bananaBoarderRightImg.src = './banana_boarder_right.png';

// Configuración de generación de obstáculos
const OBSTACLE_TYPES = {
  TREE: 'TREE',
  ROCK: 'ROCK',
  RAMP: 'RAMP',
  SNOWMAN: 'SNOWMAN',
  COIN: 'COIN',
  SHIELD: 'SHIELD',
  MAGNET: 'MAGNET'
};

// ==========================================================================
// CONTROLES (Móvil y PC)
// ==========================================================================

// Teclado (PC)
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Control direccional analógico directo y ultra responsivo (Móvil y Mouse/PC)
function updateTouchTarget(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = width / rect.width;
  touchTargetX = (clientX - rect.left) * scale;
}

canvas.addEventListener('pointerdown', (e) => {
  sound.init();
  updateTouchTarget(e.clientX);

  // Toque en la zona inferior central → toggle del contador de FPS
  const rect = canvas.getBoundingClientRect();
  const tapX = (e.clientX - rect.left) * (width / rect.width);
  const tapY = (e.clientY - rect.top) * (height / rect.height);
  if (tapX > width / 2 - 50 && tapX < width / 2 + 50 && tapY > height - 45) {
    _showFps = !_showFps;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.buttons > 0 || touchTargetX !== null) {
    updateTouchTarget(e.clientX);
  }
});

window.addEventListener('pointerup', () => {
  touchTargetX = null;
  keys['ArrowLeft'] = false;
  keys['ArrowRight'] = false;
});

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length > 0) {
    updateTouchTarget(e.touches[0].clientX);
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    updateTouchTarget(e.touches[0].clientX);
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  touchTargetX = null;
  keys['ArrowLeft'] = false;
  keys['ArrowRight'] = false;
  e.preventDefault();
}, { passive: false });


// Garantizar inicialización y resume de Web Audio API en cualquier toque o tecla
window.addEventListener('pointerdown', () => sound.init());
window.addEventListener('keydown', () => sound.init());
window.addEventListener('touchstart', () => sound.init());

// ==========================================================================
// REGISTRO DE EVENTOS UI
// ==========================================================================

muteBtn.addEventListener('click', (e) => {
  sound.init();
  const isMuted = sound.toggleMute();
  if (isMuted) {
    muteBtn.innerText = '🔇';
    muteBtn.classList.add('muted');
  } else {
    muteBtn.innerText = '🔊';
    muteBtn.classList.remove('muted');
  }
  e.stopPropagation();
});

function setCharActive(btn) {
  const skier = document.getElementById('charSkierBtn');
  const boarder = document.getElementById('charBoarderBtn');
  [skier, boarder].forEach(b => {
    if (b) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
}

function setStyleActive(btn) {
  const bBanana = document.getElementById('styleBananaBtn');
  const bHuman = document.getElementById('styleHumanBtn');
  [bBanana, bHuman].forEach(b => {
    if (b) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
}

function setDiffActive(activeBtn) {
  const dEasy = document.getElementById('diffEasyBtn');
  const dMed = document.getElementById('diffMedBtn');
  const dHard = document.getElementById('diffHardBtn');
  [dEasy, dMed, dHard].forEach(b => {
    if (b) b.classList.remove('active');
  });
  if (activeBtn) activeBtn.classList.add('active');
}

// Delegación global de todos los botones y menús principales
document.addEventListener('click', (e) => {
  // Selector de Idioma (ES / EN)
  const lBtn = e.target.closest('#langBtn');
  if (lBtn) {
    toggleLanguage();
    try { sound.playClick(); } catch (err) {}
    triggerHaptic('light');
    updateShopUI();
    renderQuestsUI();
    return;
  }

  // Selector de Personaje (Esquiador / Snowboard)
  const charBtn = e.target.closest('#charSkierBtn, #charBoarderBtn');
  if (charBtn) {
    if (charBtn.id === 'charSkierBtn') {
      selectedChar = 'SKIER';
    } else {
      selectedChar = 'BOARDER';
    }
    playerProfile.activeSkin = 'default';
    saveProfile();
    setCharActive(charBtn);
    try { sound.playClick(); } catch (err) {}
    return;
  }

  // Selector de Estilo (Plátano / Humano)
  const styleBtn = e.target.closest('#styleBananaBtn, #styleHumanBtn');
  if (styleBtn) {
    if (styleBtn.id === 'styleBananaBtn') {
      selectedStyle = 'BANANA';
    } else {
      selectedStyle = 'HUMAN';
    }
    setStyleActive(styleBtn);
    try { sound.playClick(); } catch (err) {}
    return;
  }

  // Selector de Dificultad
  const diffBtn = e.target.closest('#diffEasyBtn, #diffMedBtn, #diffHardBtn');
  if (diffBtn) {
    if (diffBtn.id === 'diffEasyBtn') currentDiff = DIFFICULTIES.EASY;
    else if (diffBtn.id === 'diffMedBtn') currentDiff = DIFFICULTIES.MEDIUM;
    else if (diffBtn.id === 'diffHardBtn') currentDiff = DIFFICULTIES.HARD;
    setDiffActive(diffBtn);
    try { sound.playClick(); } catch (err) {}
    return;
  }

  // Botón ¡JUGAR!
  const pBtn = e.target.closest('#playBtn');
  if (pBtn) {
    e.stopPropagation();
    console.log('[Game] ¡JUGAR! presionado');
    try { sound.init(); } catch (err) {}
    startGame();
    return;
  }

  // Botón MISIONES
  const qBtn = e.target.closest('#questsBtn');
  if (qBtn) {
    try { sound.init(); sound.playClick(); } catch (err) {}
    renderQuestsUI();
    const modal = document.getElementById('questsModal');
    if (modal) modal.classList.add('active');
    return;
  }

  const closeQBtn = e.target.closest('#closeQuestsBtn');
  if (closeQBtn) {
    try { sound.playClick(); } catch (err) {}
    const modal = document.getElementById('questsModal');
    if (modal) modal.classList.remove('active');
    return;
  }

  // Botón TIENDA
  const sBtn = e.target.closest('#shopBtn');
  if (sBtn) {
    try { sound.playClick(); } catch (err) {}
    updateShopUI();
    if (shopModal) shopModal.classList.add('active');
    return;
  }

  const closeSBtn = e.target.closest('#closeShopBtn');
  if (closeSBtn) {
    try { sound.playClick(); } catch (err) {}
    if (shopModal) shopModal.classList.remove('active');
    return;
  }

  // Botón CÓMO JUGAR
  const hBtn = e.target.closest('#howToBtn');
  if (hBtn) {
    try { sound.playClick(); } catch (err) {}
    if (instructionsPanel) instructionsPanel.classList.add('active');
    return;
  }

  const closeHBtn = e.target.closest('#closeInstBtn');
  if (closeHBtn) {
    try { sound.playClick(); } catch (err) {}
    if (instructionsPanel) instructionsPanel.classList.remove('active');
    return;
  }

  // Botón POLÍTICA DE PRIVACIDAD
  const privBtn = e.target.closest('#privacyBtn');
  if (privBtn) {
    try { sound.playClick(); } catch (err) {}
    if (privacyModal) privacyModal.classList.add('active');
    return;
  }

  const closePrivBtn = e.target.closest('#closePrivacyBtn');
  if (closePrivBtn) {
    try { sound.playClick(); } catch (err) {}
    if (privacyModal) privacyModal.classList.remove('active');
    return;
  }
});

freeCoinsAdBtn.addEventListener('click', () => {
  ads.showRewarded(
    () => {
      playerProfile.coins += 15;
      saveProfile();
      updateShopUI();
      sound.playCoin();
      console.log('[Shop] +15 Monedas otorgadas por ver anuncio');
    },
    () => {
      console.log('[Shop] Anuncio cancelado');
    }
  );
});

function updateShopUI() {
  updateCoinsUI();
  applyTranslations();
  document.querySelectorAll('.skin-card').forEach(card => {
    const skinKey = card.getAttribute('data-skin');
    const statusText = card.querySelector('.skin-status');
    const priceText = card.querySelector('.skin-price');
    const cardBtn = card.querySelector('button');

    const isUnlocked = playerProfile.unlockedSkins.includes(skinKey);
    const isActive = playerProfile.activeSkin === skinKey;
    const isPowerUp = skinKey === 'start_shield' || skinKey === 'super_magnet';

    if (isPowerUp) {
      if (isUnlocked) {
        card.classList.add('active');
        if (priceText) priceText.innerText = t('skin_unlocked');
        if (statusText) statusText.innerText = t('skin_active');
        if (cardBtn) {
          cardBtn.className = 'btn btn-sm btn-secondary disabled';
          cardBtn.innerText = `✅ ${t('skin_active')}`;
          cardBtn.disabled = true;
        }
      } else {
        card.classList.remove('active');
        const defaultPrice = card.getAttribute('data-price') || '300';
        if (priceText) priceText.innerText = `${defaultPrice} 🪙`;
        if (cardBtn) {
          cardBtn.className = 'btn btn-sm btn-primary buy-skin-btn';
          cardBtn.innerText = t('skin_buy');
          cardBtn.disabled = false;
          cardBtn.setAttribute('data-skin', skinKey);
        }
      }
    } else {
      if (isActive) {
        card.classList.add('active');
        if (statusText) statusText.innerText = t('skin_in_use');
        if (priceText) priceText.innerText = t('skin_equipped');
        if (cardBtn) {
          cardBtn.className = 'btn btn-sm btn-secondary select-skin-btn disabled';
          cardBtn.innerText = t('skin_equipped');
          cardBtn.disabled = true;
        }
      } else if (isUnlocked) {
        card.classList.remove('active');
        if (statusText) statusText.innerText = t('skin_unlocked');
        if (priceText) priceText.innerText = t('skin_unlocked');
        if (cardBtn) {
          cardBtn.className = 'btn btn-sm btn-primary select-skin-btn';
          cardBtn.innerText = t('skin_use');
          cardBtn.disabled = false;
          cardBtn.setAttribute('data-skin', skinKey);
        }
      } else {
        card.classList.remove('active');
        const defaultPrice = card.getAttribute('data-price') || '150';
        if (priceText) priceText.innerText = `${defaultPrice} 🪙`;
        if (cardBtn) {
          cardBtn.className = 'btn btn-sm btn-primary buy-skin-btn';
          cardBtn.innerText = t('skin_buy');
          cardBtn.disabled = false;
          cardBtn.setAttribute('data-skin', skinKey);
        }
      }
    }
  });
}

// Eventos de delegación para comprar o equipar skins
document.addEventListener('click', (e) => {
  const buyBtn = e.target.closest('.buy-skin-btn');
  if (buyBtn && !buyBtn.disabled) {
    const skinKey = buyBtn.getAttribute('data-skin');
    const card = buyBtn.closest('.skin-card');
    const price = parseInt(card.getAttribute('data-price') || buyBtn.getAttribute('data-price') || '150');

    if (playerProfile.unlockedSkins.includes(skinKey)) {
      playerProfile.activeSkin = skinKey;
      saveProfile();
      updateShopUI();
      return;
    }

    if (playerProfile.coins >= price) {
      playerProfile.coins -= price;
      playerProfile.unlockedSkins.push(skinKey);
      playerProfile.activeSkin = skinKey;
      saveProfile();
      sound.playPowerUp();
      updateShopUI();
    } else {
      alert('¡Monedas insuficientes! Mira un video o junta más en la pista.');
    }
    return;
  }

  const selectBtn = e.target.closest('.select-skin-btn');
  if (selectBtn && !selectBtn.disabled) {
    const skinKey = selectBtn.getAttribute('data-skin') || selectBtn.closest('.skin-card')?.getAttribute('data-skin');
    if (skinKey && playerProfile.unlockedSkins.includes(skinKey)) {
      playerProfile.activeSkin = skinKey;
      saveProfile();
      updateShopUI();
    }
  }
});

restartBtn.addEventListener('click', () => {
  sound.init();
  ads.hideBanner();
  startGame();
});

mainMenuBtn.addEventListener('click', () => {
  ads.hideBanner();
  showMenu();
});

reviveBtn.addEventListener('click', () => {
  if (player.hasRevived) return;
  reviveBtn.classList.add('disabled');
  reviveBtn.disabled = true;

  // Mostrar anuncio recompensado sim/real
  ads.showRewarded(
    // ÉXITO: El jugador vio el video
    () => {
      revivePlayer();
    },
    // CANCELADO / ERROR
    () => {
      console.log('[Game] No se completó el anuncio para revivir.');
    }
  );
});

// ==========================================================================
// SISTEMA DE PAUSA DEL JUEGO
// ==========================================================================

function pauseGame() {
  if (gameState !== STATES.PLAYING && gameState !== STATES.JUMPING) return;
  gameState = STATES.PAUSED;
  window.gameState = gameState;
  sound.stopMusic();
  pauseMenu.classList.add('active');
  updatePauseMuteBtn();

  // Actualizar stats del menú de pausa
  const pauseDistVal = document.getElementById('pauseDistVal');
  const pauseCoinsVal = document.getElementById('pauseCoinsVal');
  if (pauseDistVal) pauseDistVal.innerText = `${score}m`;
  if (pauseCoinsVal) pauseCoinsVal.innerText = `${playerProfile.coins}`;
}

function resumeGame() {
  if (gameState !== STATES.PAUSED) return;
  gameState = STATES.PLAYING;
  window.gameState = gameState;
  pauseMenu.classList.remove('active');
  sound.startMusic();
}

function togglePause() {
  if (gameState === STATES.PLAYING || gameState === STATES.JUMPING) {
    pauseGame();
  } else if (gameState === STATES.PAUSED) {
    resumeGame();
  }
}

function updatePauseMuteBtn() {
  if (pauseMuteBtn) {
    pauseMuteBtn.innerText = sound.muted ? '🔇 SONIDO: DESACTIVADO' : '🔊 SONIDO: ACTIVADO';
  }
}

pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

resumeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  resumeGame();
});

pauseMuteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.toggleMute();
  updatePauseMuteBtn();
});

restartPauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pauseMenu.classList.remove('active');
  ads.hideBanner();
  startGame();
});

mainMenuPauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pauseMenu.classList.remove('active');
  showMenu();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    togglePause();
  }
});

// Manejo del ciclo de vida en Navegador (Pausar audio y juego si se minimiza o cambia de pestaña)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (gameState === STATES.PLAYING || gameState === STATES.JUMPING) {
      pauseGame();
    }
    sound.stopMusic();
  }
});

// Soporte nativo para Android / Fire OS (Hardware Back Button y App Lifecycle)
try {
  App.addListener('backButton', () => {
    // 1. Si el modal de privacidad está abierto
    if (privacyModal && privacyModal.classList.contains('active')) {
      privacyModal.classList.remove('active');
      return;
    }
    // 2. Si el modal de la tienda está abierto
    if (shopModal && shopModal.classList.contains('active')) {
      shopModal.classList.remove('active');
      return;
    }
    // 3. Si el panel de instrucciones está abierto
    if (instructionsPanel && instructionsPanel.classList.contains('active')) {
      instructionsPanel.classList.remove('active');
      return;
    }
    // 4. Si el juego está en curso -> pausar
    if (gameState === STATES.PLAYING || gameState === STATES.JUMPING) {
      pauseGame();
      return;
    }
    // 5. Si está en pausa -> reanudar
    if (gameState === STATES.PAUSED) {
      resumeGame();
      return;
    }
    // 6. Si está en Game Over -> ir al menú principal
    if (gameState === STATES.GAMEOVER) {
      showMenu();
      return;
    }
    // 7. Si está en el Menú Principal -> salir de la app
    if (gameState === STATES.START) {
      App.exitApp();
    }
  });

  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      if (gameState === STATES.PLAYING || gameState === STATES.JUMPING) {
        pauseGame();
      }
      sound.stopMusic();
    }
  });
} catch (err) {
  console.log('[Native App] Listener de Capacitor no disponible en web pura:', err);
}

// Splash screen con barra de progreso animada
(function animateSplash() {
  const progressFill = document.getElementById('splashProgressFill');
  let progress = 0;
  const splashInterval = setInterval(() => {
    progress += 2 + Math.random() * 4;
    if (progress >= 100) progress = 100;
    if (progressFill) progressFill.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(splashInterval);
      setTimeout(() => {
        splashScreen.classList.remove('active');
        showMenu();
      }, 300);
    }
  }, 50);
})();

function showMenu() {
  gameState = STATES.START;
  window.gameState = gameState;
  sound.stopMusic();
  
  mainMenu.classList.add('active');
  gameOverMenu.classList.remove('active');
  pauseMenu.classList.remove('active');
  gameHUD.classList.remove('active');
  yetiWarning.classList.remove('active');
  if (yetiTerrorOverlay) yetiTerrorOverlay.classList.remove('active');
  pauseBtn.style.display = 'none';

  // Limpiar confetti si existe
  const oldConfetti = document.querySelector('.confetti-container');
  if (oldConfetti) oldConfetti.remove();

  ads.showBanner();
}

// ==========================================================================
// INICIALIZACIÓN Y CICLO DEL JUEGO
// ==========================================================================

function startGame() {
  gameState = STATES.PLAYING;
  window.gameState = gameState;
  mainMenu.classList.remove('active');
  gameOverMenu.classList.remove('active');
  pauseMenu.classList.remove('active');
  gameHUD.classList.add('active');
  yetiWarning.classList.remove('active');
  if (yetiTerrorOverlay) yetiTerrorOverlay.classList.remove('active');
  pauseBtn.style.display = 'flex';
  
  // Reiniciar variables
  score = 0;
  distanceVal.innerText = '0m';
  speedVal.innerText = '0 km/h';

  player.x = width / 2;
  player.y = 100;
  smoothedCameraY = player.y - 180;
  player.speedX = 0;
  player.baseSpeedY = currentDiff.baseSpeed;
  player.speedY = player.baseSpeedY;
  player.angle = 0;
  player.jumpAirTime = 0;
  player.jumpScale = 1;
  player._landingTimer = 0;
  player.hasRevived = false;
  player.crashCooldown = 0;
  player.isTurbo = false;
  player.turboTimer = 0;
  player.trickBonus = 0;
  
  // Equipar Escudo Inicial si fue comprado en la tienda
  player.hasShield = playerProfile.unlockedSkins.includes('start_shield');
  player.hasMagnet = false;
  player.magnetTimer = 0;

  // Habilidades de Skins especiales
  const skin = playerProfile.activeSkin || 'default';
  player.fireArmor = (skin === 'fire'); // 1 quema de obstáculo disponible
  player.isCyber = (skin === 'cyber');   // Micro-imán pasivo permanente
  player.isMidas = (skin === 'yeti_gold'); // Monedas x2 y +15% de metros
  updatePowerUpBadges();

  yeti.active = false;
  yeti.isStunned = false;
  yeti.stunTimer = 0;
  yeti.y = -200;

  obstacles = [];
  skiTracks = [];
  particles = [];

  // Generar obstáculos iniciales distribuidos delante
  let startY = player.y + 150;
  for (let i = 0; i < 20; i++) {
    spawnObstacle(startY);
    startY += Math.random() * currentDiff.obsStep + 45;
  }

  // Activar música de fondo de forma segura
  try {
    sound.init();
    sound.playNormalTheme();
    sound.setSpeed(1.0);
    sound.startMusic();
  } catch (err) {
    console.warn('[Sound] Error reproduciendo música:', err);
  }

  // Desactivar anuncios banner en partida
  try {
    ads.hideBanner();
  } catch (err) {}
}

function revivePlayer() {
  gameState = STATES.PLAYING;
  window.gameState = gameState;
  gameOverMenu.classList.remove('active');
  pauseMenu.classList.remove('active');
  gameHUD.classList.add('active');
  if (pauseBtn) pauseBtn.style.display = 'flex';
  
  player.speedX = 0;
  player.speedY = player.baseSpeedY;
  player.angle = 0;
  player.jumpAirTime = 0;
  player.jumpScale = 1;
  player._landingTimer = 0;
  player.hasRevived = true;
  player.crashCooldown = 120; // Invulnerabilidad temporal de 2 segundos (120 frames)

  // Despejar obstáculos cercanos al revivir para no chocar al instante
  obstacles = obstacles.filter(obs => Math.abs(obs.y - player.y) > 200);

  // Si el Yeti estaba cerca, alejarlo un poco para dar aire
  if (yeti.active) {
    yeti.y = player.y - 300;
    yeti.isStunned = true;
    yeti.stunTimer = 120; // Aturdirlo 2 segundos para permitir escape
  }

  // Activar música
  sound.playNormalTheme();
  sound.setSpeed(1.0);
  sound.startMusic();

  ads.hideBanner();
}

// Bucle de física y dibujo con deltaTime para framerate independiente
let _lastFrameTime = 0;
let _frameCount = 0;

// --- CONTADOR DE FPS ---
let _fpsDisplay = 0;
let _fpsFrames = 0;
let _fpsWindowStart = 0;
let _showFps = true;

// --- CAP DE FPS EN MOBILE ---
// En mobile apuntamos a 30fps estables en lugar de intentar 60fps y colapsar a 4fps.
// En desktop dejamos correr a 60fps nativo.
const _targetInterval = isMobile ? 1000 / 30 : 0; // 33ms entre frames en mobile, 0 = sin límite
let _lastRenderTime = 0;

function update(timestamp) {
  requestAnimationFrame(update); // Siempre registrar el siguiente frame

  if (!_lastFrameTime) {
    _lastFrameTime = timestamp;
    _fpsWindowStart = timestamp;
    _lastRenderTime = timestamp;
  }

  // En mobile: saltar el frame si no pasaron los 33ms (~30fps)
  if (_targetInterval > 0) {
    const sinceLastRender = timestamp - _lastRenderTime;
    if (sinceLastRender < _targetInterval) return;
    _lastRenderTime = timestamp;
  }

  const deltaMs = timestamp - _lastFrameTime;
  _lastFrameTime = timestamp;
  _frameCount++;
  _fpsFrames++;

  // Actualizar FPS cada segundo
  const elapsed = timestamp - _fpsWindowStart;
  if (elapsed >= 1000) {
    _fpsDisplay = Math.round(_fpsFrames * 1000 / elapsed);
    _fpsFrames = 0;
    _fpsWindowStart = timestamp;
  }

  if (gameState === STATES.PLAYING || gameState === STATES.JUMPING || gameState === STATES.CRASHED || gameState === STATES.EATEN) {
    updateGameLogic();
  }

  render();
}

// Iniciar bucle
requestAnimationFrame(update);

// ==========================================================================
// LÓGICA DE JUEGO (CÁLCULOS Y FÍSICAS)
// ==========================================================================

function updateGameLogic() {
  if (player.crashCooldown > 0) {
    player.crashCooldown--;
  }

  // --- 1. ACTUALIZAR JUGADOR ---
  if (gameState === STATES.PLAYING || gameState === STATES.JUMPING) {
    // Aceleración y maniobrabilidad en X (Súper ágil, responsiva y fluida)
    const maxLat = selectedChar === 'SKIER' ? 6.5 : 5.8;
    const accelRate = selectedChar === 'SKIER' ? 1.3 : 1.1;
    player.maxSpeedX = maxLat;

    if (touchTargetX !== null) {
      // Control táctil analógico progresivo según la distancia al dedo
      const diffX = touchTargetX - player.x;
      player.speedX += diffX * 0.16;
      player.speedX *= 0.83;
    } else if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      player.speedX -= accelRate;
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      player.speedX += accelRate;
    } else {
      player.speedX *= 0.83;
    }

    // Límites de velocidad horizontal
    player.speedX = Math.max(-player.maxSpeedX, Math.min(player.maxSpeedX, player.speedX));
    player.x += player.speedX;

    // Ángulo de inclinación súper fluido interpolado con lerp (sin micro-saltos)
    const targetAngle = (player.speedX / player.maxSpeedX) * 0.65;
    player.angle += (targetAngle - player.angle) * 0.25;

    // Clampar límites laterales del mapa
    if (player.x < player.width) {
      player.x = player.width;
      player.speedX = 0;
    }
    if (player.x > width - player.width) {
      player.x = width - player.width;
      player.speedX = 0;
    }

    // Garantizar que currentDiff siempre sea un objeto válido con valores por defecto
    const safeDiff = currentDiff || DIFFICULTIES.MEDIUM;
    const speedDiv = (safeDiff && safeDiff.speedDiv) ? safeDiff.speedDiv : 4500;
    const baseSpeed = (safeDiff && safeDiff.baseSpeed) ? safeDiff.baseSpeed : 4.0;

    // Movimiento vertical progresivo con la distancia según dificultad + Super Turbo
    let targetSpeedY = baseSpeed + Math.min(8.5, (player.y / speedDiv));
    if (isNaN(targetSpeedY) || !isFinite(targetSpeedY)) targetSpeedY = baseSpeed;

    // Si está en Super-Turbo tras salir de una rampa
    if (player.turboTimer > 0) {
      player.turboTimer--;
      targetSpeedY += 3.5; // Boost masivo de velocidad
      
      // Partículas neón de estela turbo detrás de los esquís
      if (Math.random() < 0.7) {
        const pColor = Math.random() < 0.5 ? '#00f3ff' : '#ff0055';
        spawnParticle(player.x + (Math.random() * 10 - 5), player.y, pColor, 3, (Math.random() * 2 - 1), Math.random() * 3 + 1);
      }

      if (player.turboTimer === 0) {
        player.isTurbo = false;
      }
    }

    if (isNaN(player.speedY) || !isFinite(player.speedY)) player.speedY = baseSpeed;
    player.speedY += (targetSpeedY - player.speedY) * 0.1;

    if (isNaN(player.y) || !isFinite(player.y)) player.y = 100;
    player.y += player.speedY;

    // Lógica del Salto (Rampas)
    if (gameState === STATES.JUMPING) {
      player.jumpAirTime++;
      // Arco parabólico para simular altura del salto
      const progress = player.jumpAirTime / player.jumpDuration;
      player.jumpScale = 1 + Math.sin(progress * Math.PI) * 0.6; // Crece hasta 1.6 y vuelve a 1

      // Generar efecto de destellos neón en el aire
      if (Math.random() < 0.4) {
        spawnParticle(player.x, player.y, '#00f3ff', 2.5, Math.random() * 2 - 1, Math.random() * 2 - 1);
      }

      if (player.jumpAirTime >= player.jumpDuration) {
        gameState = STATES.PLAYING;
        player.jumpScale = 1;
        player._landingTimer = 8; // Squash-stretch retro al aterrizar
        
        // ¡ACTIVAR SUPER-TURBO AL ATERRIZAR!
        player.isTurbo = true;
        player.turboTimer = 65; // ~1.1 segundos de turbo desatado
        sound.playTurbo(); // Sonido de impulso turbo
        sound.playReward(); // Sonido de recompensa por truco
        triggerHaptic('medium');
        updateQuestProgress('jumps_3', 1);

        // Otorgar Bonus de Truco (Distancia + Monedas)
        player.trickBonus = (player.trickBonus || 0) + 50;
        playerProfile.coins += 5;
        saveProfile(); // saveProfile automáticamente llama a updateCoinsUI()

        // Cartel flotante de truco sobre el personaje
        spawnFloatingText(player.x, player.y - 40, '✨ 360 SPIN! +50m +5🪙', '#00f3ff', 16);

        // Al caer, crear destellos e impacto masivo de partículas doradas y cian
        for (let i = 0; i < 18; i++) {
          const pColor = i % 2 === 0 ? '#00f3ff' : '#fbbf24';
          spawnParticle(player.x, player.y, pColor, 3.5, Math.random() * 6 - 3, Math.random() * -4 - 1);
        }
      }
    } else {
      // Dejar huellas en la nieve (solo en el suelo) — throttleado en mobile
      _trackFrameSkip++;
      const shouldAddTrack = !isMobile || (_trackFrameSkip % 3 === 0);
      if (shouldAddTrack) {
        if (selectedChar === 'BOARDER') {
          addTrack(player.x, player.y, 3.5, 0.35);
        } else {
          if (Math.abs(player.speedX) > 0.5) {
            addTrack(player.x - 4, player.y);
            addTrack(player.x + 4, player.y);
          } else {
            addTrack(player.x - 3, player.y);
            addTrack(player.x + 3, player.y);
          }
        }
      }

      // Spray de nieve al girar fuerte (reducido en mobile)
      const sprayChance = isMobile ? 0.15 : 0.4;
      if (Math.abs(player.speedX) > 2.5 && Math.random() < sprayChance) {
        spawnParticle(player.x, player.y, '#ffffff', 2, -player.speedX * 0.5 + (Math.random() * 2 - 1), -1);
      }
    }

    // Calcular score (con multiplicador de dificultad + bonus de skin + bonus de trucos)
    const skinScoreMult = player.isMidas ? 1.15 : 1.0;
    score = Math.floor((player.y / 10) * currentDiff.mult * skinScoreMult) + (player.trickBonus || 0);

    // Throttle DOM updates: actualizar cada 6 frames para no forzar repaints continuos
    if (_frameCount % 6 === 0) {
      distanceVal.innerText = `${score}m`;

      // Velocidad en km/h con color dinámico
      const speedKmh = Math.floor(player.speedY * 12);
      speedVal.innerText = `${speedKmh}`;
      // Color: azul → naranja → rojo según velocidad
      if (speedKmh < 55) {
        speedVal.style.color = '#f1f5f9';
      } else if (speedKmh < 80) {
        speedVal.style.color = '#fbbf24';
      } else {
        speedVal.style.color = '#ef4444';
      }
    }

    // Celebración en vivo al superar el récord durante la carrera
    if (highScore > 40 && score > highScore && !player._recordBroken) {
      player._recordBroken = true;
      sound.playReward();
      triggerHaptic('success');
      spawnFloatingText(player.x, player.y - 45, '🏆 ¡NUEVO RÉCORD!', '#fbbf24', 18);
      for (let i = 0; i < 20; i++) {
        const pColor = i % 3 === 0 ? '#fbbf24' : (i % 3 === 1 ? '#00f3ff' : '#f43f5e');
        spawnParticle(player.x, player.y, pColor, 3.5, Math.random() * 8 - 4, Math.random() * -5 - 2);
      }
    }
  }

  // --- 2. GESTIÓN DEL YETI ---
  const yetiThreshold = selectedYetiThreshold;
  if (selectedYetiThreshold < 900000 && score >= yetiThreshold && !yeti.active) {
    yeti.active = true;
    yeti.y = player.y - 450; // Aparece desde atrás en la pantalla
    yeti.x = player.x;
    
    // Alerta inicial de 3 segundos (luego se oculta para no tapar la vista del radar y canvas)
    yetiWarning.classList.add('active');
    setTimeout(() => {
      yetiWarning.classList.remove('active');
    }, 3200);
    
    // Cambiar a música de combate del Yeti y sonar alerta
    sound.playYetiTheme();
    sound.playYetiWarning();
    triggerHaptic('heavy');
  }

  if (yeti.active) {
    if (yetiTerrorOverlay && gameState === STATES.PLAYING) {
      yetiTerrorOverlay.classList.add('active');
    }

    // Actualizar Warning del HUD (throttleado: cada 6 frames para evitar reflow continuo)
    const distanceToYeti = Math.floor((player.y - yeti.y) / 10);
    if (distanceToYeti > 0 && gameState === STATES.PLAYING) {
      if (_frameCount % 6 === 0) {
        yetiDistanceLabel.innerHTML = `¡El Yeti está a <strong>${distanceToYeti}m</strong> de ti!`;
      }
      
      // Temblor de pantalla (Camera Shake) por las monstruosas pisadas del Yeti
      if (distanceToYeti < 35 && Math.sin((Date.now() * 0.015)) > 0.4) {
        cameraShakeY = (Math.random() - 0.5) * Math.max(1, (35 - distanceToYeti) * 0.4);
        if (Math.random() < 0.1) triggerHaptic('light');
      } else {
        cameraShakeY = 0;
      }

      // Sonido de alerta recurrente a medida que se acerca
      if (distanceToYeti < 50 && Math.floor(player.y / 10) % 20 === 0) {
        sound.playYetiWarning();
      }

      // Acelerar la música dinámicamente cuanto más cerca esté el Yeti
      const proximityFactor = Math.max(0, 1 - (distanceToYeti / 45)); // de 0 (lejos) a 1 (al lado)
      sound.setSpeed(1.0 + proximityFactor * 0.45); // hasta un 45% más rápido
    } else if (gameState === STATES.EATEN) {
      if (_frameCount % 6 === 0) yetiDistanceLabel.innerText = `¡Fuiste devorado!`;
      if (yetiTerrorOverlay) yetiTerrorOverlay.classList.remove('active');
      cameraShakeY = 0;
    }

    // Movimiento del Yeti
    if (!yeti.isStunned && gameState !== STATES.EATEN) {
      // El Yeti corre un 15% más rápido que el jugador, y acelera aún más con el tiempo
      const timeFactor = Math.min(3, (player.y - (yetiThreshold * 10)) / 10000);
      yeti.speedY = player.speedY * (1.15 + timeFactor);
      yeti.y += yeti.speedY;

      // El Yeti persigue la X del jugador
      yeti.x += (player.x - yeti.x) * yeti.easeX;

      // Animación de correr
      yeti.animFrame += 0.25;
    } else if (yeti.isStunned) {
      // Temporizador de aturdimiento
      yeti.stunTimer--;
      if (yeti.stunTimer <= 0) {
        yeti.isStunned = false;
        // Al despertar, dar un salto de enfado
        yeti.speedY = player.speedY * 1.2;
      }
    }

    // Huellas gigantes del Yeti
    if (!yeti.isStunned && Math.random() < 0.6 && gameState !== STATES.EATEN) {
      addTrack(yeti.x - 12, yeti.y, 4, 0.4);
      addTrack(yeti.x + 12, yeti.y, 4, 0.4);
    }

    // Colisión del Yeti con Obstáculos (esquivar/aturdir)
    if (!yeti.isStunned && gameState !== STATES.EATEN) {
      for (let obs of obstacles) {
        if (obs.type !== OBSTACLE_TYPES.RAMP) {
          // Detectar colisión cercana del Yeti (usando distSq para evitar sqrt)
          const dx = yeti.x - obs.x;
          const dy = yeti.y - obs.y;
          const yColR = yeti.width / 2 + obs.radius;
          
          // El Yeti tiene un radio de colisión más grande por su tamaño
          if (dx * dx + dy * dy < yColR * yColR) {
            // ¡Yeti choca y queda aturdido!
            yeti.isStunned = true;
            yeti.stunTimer = 90; // 1.5 segundos
            
            // Sonido de choque para el Yeti (diferenciado)
            sound.playCrash(obs.type);

            // Crear partículas del impacto según el color del obstáculo
            const yColor = obs.type === 'TREE' ? '#15803d' : '#475569';
            for (let i = 0; i < 12; i++) {
              spawnParticle(yeti.x, yeti.y, yColor, 3, Math.random() * 4 - 2, Math.random() * -3 - 2);
            }
            break;
          }
        }
      }
    }

    // Colisión Yeti contra Jugador
    if (gameState === STATES.PLAYING) {
      const dx = player.x - yeti.x;
      const dy = player.y - yeti.y;
      const yetiColR = player.width / 2 + yeti.width / 2 - 5;

      if (dx * dx + dy * dy < yetiColR * yetiColR) {
        // ¡El Yeti te come!
        gameState = STATES.EATEN;
        window.gameState = gameState;
        triggerHaptic('heavy');
        
        // Detener música y reproducir grito de terror y comer
        sound.stopMusic();
        sound.playScream();
        setTimeout(() => {
          sound.playEat();
        }, 150); // Pequeño delay para superponerlos de forma limpia

        yeti.eatingTimer = 120; // 2 segundos de animación
        player.speedX = 0;
        player.speedY = 0;
        // Crear partículas de nieve y girones
        for (let i = 0; i < 15; i++) {
          spawnParticle(player.x, player.y, '#ef4444', 3, Math.random() * 6 - 3, Math.random() * -4 - 1);
        }
      }
    }

    // Lógica de animación de comer
    if (gameState === STATES.EATEN) {
      yeti.eatingTimer--;
      // El Yeti se posiciona sobre el jugador
      yeti.x += (player.x - yeti.x) * 0.2;
      yeti.y += (player.y - yeti.y) * 0.2;
      yeti.animFrame += 0.2;

      if (yeti.eatingTimer <= 0) {
        triggerGameOver(t('gameover_yeti'), true);
      }
    }
  }

  // --- 3. GENERAR Y ACTUALIZAR OBSTÁCULOS ---
  // Limpiar obstáculos que se quedan muy atrás de la cámara (mantener monedas con imán)
  let oIndex = 0;
  for (let i = 0; i < obstacles.length; i++) {
    if (obstacles[i].y > player.y - (player.hasMagnet ? 500 : 250)) {
      obstacles[oIndex++] = obstacles[i];
    }
  }
  obstacles.length = oIndex;

  // Generar nuevos obstáculos adelante continuamente
  let lastObsY = obstacles.length > 0 ? obstacles[obstacles.length - 1].y : player.y + 120;
  while (lastObsY < player.y + height + 400) {
    lastObsY += Math.random() * currentDiff.obsStep + 40;
    spawnObstacle(lastObsY);
  }

  // Lógica de temporizador de Imán y atracción magnética equilibrada (con micro-imán Cyberpunk pasivo)
  const hasActiveMagnet = player.hasMagnet || player.isCyber;
  if (hasActiveMagnet) {
    if (player.hasMagnet) {
      player.magnetTimer--;
      if (player.magnetTimer <= 0) {
        player.hasMagnet = false;
        updatePowerUpBadges();
      }
    }

    // Rango de atracción: 170px con ítem recogido o 95px con micro-imán pasivo Cyberpunk
    const magnetRange = player.hasMagnet ? 170 : 95;
    const magnetRangeSq = magnetRange * magnetRange;
    for (let obs of obstacles) {
      if (!obs.collected && obs.type === OBSTACLE_TYPES.COIN) {
        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < magnetRangeSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          // Atracción suave que aumenta proporcionalmente a la cercanía
          const pullProgress = 1 - (dist / magnetRange);
          const pullSpeed = (player.hasMagnet ? 4.5 : 2.8) + pullProgress * 7.5 + (player.speedY * 0.3);
          obs.x += (dx / dist) * pullSpeed;
          obs.y += (dy / dist) * pullSpeed;
        }
      }
    }
  }

  // Comprobar colisiones e interacciones Jugador vs Obstáculo / Ítems
  if (gameState === STATES.PLAYING) {
    for (let obs of obstacles) {
      if (obs.collected) continue;

      const dx = player.x - obs.x;
      const dy = player.y - obs.y;
      const distSq = dx * dx + dy * dy;
      const collideR = player.width / 2 + obs.radius;

      // --- Roce Rasante / Close Call (Slalom Pro) ---
      if (!obs._nearMiss && distSq >= collideR * collideR && distSq < (collideR + 15) * (collideR + 15) &&
          (obs.type === OBSTACLE_TYPES.TREE || obs.type === OBSTACLE_TYPES.ROCK || obs.type === OBSTACLE_TYPES.SNOWMAN)) {
        obs._nearMiss = true;
        player.trickBonus = (player.trickBonus || 0) + 10;
        spawnFloatingText(player.x, player.y - 25, '🔥 CLOSE CALL! +10m', '#f97316', 13);
        sound.playNearMiss();
        triggerHaptic('light');
        updateQuestProgress('close_5', 1);
        for (let s = 0; s < 4; s++) {
          spawnParticle(player.x, player.y, '#ffffff', 2, (Math.random() - 0.5) * 4, -1);
        }
      }

      if (distSq < collideR * collideR) {
        if (obs.type === OBSTACLE_TYPES.COIN) {
          // Moneda Dorada recogida (Skin Corona Dorada otorga +2 🪙)
          obs.collected = true;
          const coinVal = player.isMidas ? 2 : 1;
          playerProfile.coins += coinVal;
          saveProfile();
          sound.playCoin();
          triggerHaptic('light');
          updateQuestProgress('coins_15', 1);
          spawnFloatingText(obs.x, obs.y - 12, player.isMidas ? '+2 🪙 MIDAS!' : '+1 🪙', '#fbbf24', player.isMidas ? 16 : 14);
          for (let i = 0; i < (player.isMidas ? 10 : 6); i++) {
            spawnParticle(obs.x, obs.y, '#ffad00', 2.5, Math.random() * 4 - 2, Math.random() * 4 - 2);
          }
        } else if (obs.type === OBSTACLE_TYPES.SHIELD) {
          // Escudo de Nieve recogido
          obs.collected = true;
          player.hasShield = true;
          updatePowerUpBadges();
          sound.playPowerUp();
          triggerHaptic('medium');
          spawnFloatingText(obs.x, obs.y - 15, '🛡️ ESCUDO ACTIVO', '#00f3ff', 14);
          for (let i = 0; i < 10; i++) {
            spawnParticle(obs.x, obs.y, '#00f3ff', 3, Math.random() * 5 - 2.5, Math.random() * 5 - 2.5);
          }
        } else if (obs.type === OBSTACLE_TYPES.MAGNET) {
          // Imán de Monedas recogido (Súper Imán perk duplica duración)
          obs.collected = true;
          player.hasMagnet = true;
          const hasSuper = playerProfile.unlockedSkins.includes('super_magnet');
          player.magnetTimer = hasSuper ? 720 : 360; // 12 segs o 6 segs
          updatePowerUpBadges();
          sound.playPowerUp();
          triggerHaptic('medium');
          spawnFloatingText(obs.x, obs.y - 15, hasSuper ? '🧲 IMÁN x2 ACTIVADO' : '🧲 IMÁN ACTIVADO', '#c084fc', 14);
          for (let i = 0; i < 10; i++) {
            spawnParticle(obs.x, obs.y, '#c084fc', 3, Math.random() * 5 - 2.5, Math.random() * 5 - 2.5);
          }
        } else if (obs.type === OBSTACLE_TYPES.RAMP) {
          // ¡Rampa de salto activa!
          gameState = STATES.JUMPING;
          window.gameState = gameState;
          sound.playJump();
          player.jumpAirTime = 0;
          player.speedY += 2;
        } else if (player.crashCooldown === 0 && (obs.type === OBSTACLE_TYPES.TREE || obs.type === OBSTACLE_TYPES.ROCK || obs.type === OBSTACLE_TYPES.SNOWMAN)) {
          // 1. Si el jugador tiene ESCUDO ACTIVO:
          if (player.hasShield) {
            player.hasShield = false;
            updatePowerUpBadges();
            player.crashCooldown = 60; // 1 segundo de invulnerabilidad tras estallar el escudo
            obs.collected = true; // Destruir el obstáculo
            sound.playPowerUp(); // Sonido de choque absorbido
            triggerHaptic('heavy');
            spawnFloatingText(player.x, player.y - 25, '🛡️ ¡ESCUDO ABSORBIÓ CHOQUE!', '#00f3ff', 14);
            for (let i = 0; i < 16; i++) {
              spawnParticle(player.x, player.y, '#00f3ff', 3.5, Math.random() * 6 - 3, Math.random() * 6 - 3);
            }
          // 2. Si el jugador tiene LLAMARADA TÉRMICA (Skin Fuego):
          } else if (player.fireArmor) {
            player.fireArmor = false;
            obs.collected = true; // Quema y destruye el obstáculo
            player.crashCooldown = 50; // Invulnerabilidad
            sound.playPowerUp();
            triggerHaptic('heavy');
            spawnFloatingText(player.x, player.y - 25, '🔥 ¡OBSTÁCULO QUEMADO!', '#f97316', 15);
            for (let i = 0; i < 18; i++) {
              spawnParticle(player.x, player.y, '#f97316', 3.5, Math.random() * 6 - 3, Math.random() * 6 - 3);
              spawnParticle(player.x, player.y, '#fbbf24', 2.5, Math.random() * 4 - 2, Math.random() * 4 - 2);
            }
          } else {
            // ¡Choque común sin escudo ni fuego!
            gameState = STATES.CRASHED;
            window.gameState = gameState;
            sound.stopMusic();
            sound.playCrash(obs.type);
            triggerHaptic('heavy');

            player.speedX = 0;
            player.speedY = 0;
            const pColor = obs.type === 'TREE' ? '#15803d' : '#475569';
            for (let i = 0; i < 16; i++) {
              spawnParticle(player.x, player.y, pColor, 3, Math.random() * 6 - 3, Math.random() * -4 - 1);
            }
            
            setTimeout(() => {
              if (gameState === STATES.CRASHED) {
                triggerGameOver(obs.type === 'TREE' ? t('gameover_tree') : t('gameover_rock'), false);
              }
            }, 350);
          }
          break;
        }
      }
    }
  }

  // --- 4. ACTUALIZAR PARTÍCULAS ---
  let pIndex = 0;
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    if (p.alpha > 0) {
      particles[pIndex++] = p;
    }
  }
  particles.length = pIndex;

  // --- 5. ACTUALIZAR RASTROS DE ESQUÍ ---
  let sIndex = 0;
  for (let i = 0; i < skiTracks.length; i++) {
    let t = skiTracks[i];
    t.alpha -= 0.005; // Se desvanecen lentamente
    if (t.alpha > 0) {
      skiTracks[sIndex++] = t;
    }
  }
  skiTracks.length = sIndex;
}

// ==========================================================================
// GENERACIÓN DE ELEMENTOS DINÁMICOS
// ==========================================================================

function spawnObstacle(yCoord) {
  if (yCoord < player.y + 40) return;

  const typeRand = Math.random();
  let type = OBSTACLE_TYPES.TREE;
  let radius = 10;
  let size = 26;

  if (typeRand < 0.38) {
    type = OBSTACLE_TYPES.TREE;
    radius = 11;
    size = 28 + Math.random() * 12;
  } else if (typeRand < 0.54) {
    type = OBSTACLE_TYPES.ROCK;
    radius = 12;
    size = 20 + Math.random() * 8;
  } else if (typeRand < 0.66) {
    type = OBSTACLE_TYPES.SNOWMAN;
    radius = 11;
    size = 26;
  } else if (typeRand < 0.80) {
    type = OBSTACLE_TYPES.COIN;
    radius = 12;
    size = 20;
  } else if (typeRand < 0.88) {
    type = OBSTACLE_TYPES.RAMP;
    radius = 16;
    size = 34;
  } else if (typeRand < 0.94) {
    type = OBSTACLE_TYPES.SHIELD;
    radius = 14;
    size = 24;
  } else {
    type = OBSTACLE_TYPES.MAGNET;
    radius = 14;
    size = 24;
  }

  const margin = 30;
  const x = margin + Math.random() * (width - margin * 2);

  obstacles.push({
    x, y: yCoord, type, radius, size,
    collected: false,
    rot: Math.random() * Math.PI,
    variant: Math.floor(Math.random() * 2)
  });
}

function spawnParticle(x, y, color, size, vx, vy, decay = 0.02) {
  // Limitar partículas en mobile para evitar acumulación
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({
    x,
    y,
    color,
    size,
    vx,
    vy,
    alpha: 1,
    decay
  });
}

function addTrack(x, y, size = 1.5, alpha = 0.25) {
  // Limitar cantidad de tracks para evitar acumulación en mobile
  if (skiTracks.length >= MAX_SKI_TRACKS) return;
  skiTracks.push({
    x,
    y,
    size,
    alpha
  });
}

// ==========================================================================
// PANTALLA GAME OVER E INTEGRACIÓN DE ANUNCIOS
// ==========================================================================

function triggerGameOver(reason, eatenByYeti = false) {
  gameState = STATES.GAMEOVER;
  window.gameState = gameState;
  sound.stopMusic();
  
  // Detectar nuevo récord
  const isNewRecord = score > highScore;

  // Guardar récord
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem('ski_escape_highscore', highScore);
    highScoreVal.innerText = `${highScore}m`;
  }

  // Llenar datos de UI
  if (gameOverTitle) gameOverTitle.innerText = t('gameover_title');
  gameOverReason.innerText = reason;
  finalScoreVal.innerText = `${score}m`;
  currentRecordVal.innerText = `${highScore}m`;

  // Badge de nuevo récord
  const newRecordBadge = document.getElementById('newRecordBadge');
  if (newRecordBadge) {
    newRecordBadge.innerText = t('new_record_text');
    newRecordBadge.style.display = isNewRecord ? 'inline-block' : 'none';
  }

  // Confetti en nuevo récord
  if (isNewRecord) {
    spawnConfetti();
  }

  // Configuración del botón de revivir
  const reviveLabel = document.getElementById('reviveBtnLabel') || reviveBtn.querySelector('span:last-child');
  if (player.hasRevived || eatenByYeti) {
    reviveBtn.classList.add('disabled');
    reviveBtn.disabled = true;
    if (reviveLabel) {
      reviveLabel.innerText = eatenByYeti 
        ? (getLanguage() === 'EN' ? "CANNOT REVIVE FROM YETI" : "NO SE PUEDE REVIVIR DEL YETI")
        : (getLanguage() === 'EN' ? "ALREADY REVIVED" : "YA HAS REVIVIDO");
    }
  } else {
    reviveBtn.classList.remove('disabled');
    reviveBtn.disabled = false;
    if (reviveLabel) reviveLabel.innerText = t('gameover_revive');
  }

  // Mostrar el menú con shake si fue comido
  gameHUD.classList.remove('active');
  yetiWarning.classList.remove('active');
  pauseMenu.classList.remove('active');
  if (pauseBtn) pauseBtn.style.display = 'none';
  gameOverMenu.classList.add('active');

  // Shake animation en game over
  const goPanel = gameOverMenu.querySelector('.glass-panel');
  if (goPanel) {
    goPanel.classList.add('shake');
    setTimeout(() => goPanel.classList.remove('shake'), 500);
  }

  // Mostrar publicidad según cómo murió
  if (eatenByYeti) {
    console.log('[Game] Jugador comido por el Yeti. Cargando anuncio intersticial...');
    ads.showInterstitial(() => {
      console.log('[Game] Anuncio intersticial finalizado, mostrando banner.');
      ads.showBanner();
    });
  } else {
    ads.showBanner();
  }
}

// Confetti para nuevo récord
function spawnConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.getElementById('gameContainer').appendChild(container);

  const colors = ['#fbbf24', '#f97316', '#ef4444', '#00d4ff', '#10b981', '#a78bfa'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.width = (5 + Math.random() * 6) + 'px';
    piece.style.height = (5 + Math.random() * 6) + 'px';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 4500);
}

// ==========================================================================
// RENDERIZADO DEL JUEGO (CANVAS 2D)
// ==========================================================================

function render() {
  // Limpiar pantalla con tinte dinámico de paisaje alpino (Día -> Atardecer -> Noche Polar)
  let bgR = 248, bgG = 250, bgB = 252; // Día Alpino Pristino
  if (score > 1000 && score <= 2200) {
    // Atardecer dorado / lavanda
    const t = (score - 1000) / 1200;
    bgR = Math.round(248 - t * 8);
    bgG = Math.round(250 - t * 24);
    bgB = Math.round(252 - t * 14);
  } else if (score > 2200) {
    // Noche polar / aurora borealis suave
    const t = Math.min(1, (score - 2200) / 1500);
    bgR = Math.round(240 - t * 28);
    bgG = Math.round(226 - t * 30);
    bgB = Math.round(238 - t * 16);
  }
  ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
  ctx.fillRect(0, 0, width, height);

  // El juego se dibuja con una cámara con seguimiento interpolado ultra fluido.
  const safePlayerY = (isNaN(player.y) || !isFinite(player.y)) ? 100 : player.y;
  const targetCameraY = safePlayerY - 180 + cameraShakeY;
  if (!smoothedCameraY || isNaN(smoothedCameraY)) smoothedCameraY = targetCameraY;
  smoothedCameraY += (targetCameraY - smoothedCameraY) * 0.25;
  const cameraY = smoothedCameraY;

  // 1. Dibujar Rastros de Esquí (Tracks)
  ctx.lineWidth = 1;
  skiTracks.forEach(t => {
    const screenY = t.y - cameraY;
    if (screenY > -50 && screenY < height + 50) {
      ctx.fillStyle = `rgba(148, 163, 184, ${t.alpha})`; // Color gris azulado suave
      ctx.fillRect(t.x - t.size, screenY - t.size, t.size * 2, t.size * 2);
    }
  });

  // 2. Dibujar Obstáculos (simplificado en mobile para reducir draw calls)
  obstacles.forEach(obs => {
    const screenY = obs.y - cameraY;
    if (screenY > -100 && screenY < height + 100) {
      if (isMobile) {
        drawObstacleSimple(obs.x, screenY, obs);
      } else {
        drawObstacle(obs.x, screenY, obs);
      }
    }
  });

  // 3. Dibujar Partículas
  particles.forEach(p => {
    const screenY = p.y - cameraY;
    if (screenY > -50 && screenY < height + 50) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size, screenY - p.size, p.size * 2, p.size * 2);
      ctx.restore();
    }
  });

  // 4. Dibujar al Esquiador (Jugador)
  if (gameState !== STATES.EATEN && (gameState === STATES.PLAYING || gameState === STATES.JUMPING || gameState === STATES.CRASHED || gameState === STATES.GAMEOVER)) {
    drawPlayer(player.x, player.y - cameraY);
  }

  // 5. Dibujar Textos Flotantes de Trucos / Monedas
  updateAndDrawFloatingTexts(cameraY);

  // 6. Dibujar al Yeti y su Indicador de Radar Off-screen
  if (yeti.active) {
    const screenY = yeti.y - cameraY;
    if (screenY > -150 && screenY < height + 150) {
      drawYeti(yeti.x, screenY);
    }

    // Indicador táctico si está fuera de pantalla por arriba
    if (screenY < 40 && gameState === STATES.PLAYING) {
      const trackerX = Math.max(60, Math.min(width - 60, yeti.x));
      const distM = Math.floor((player.y - yeti.y) / 10);
      
      ctx.save();
      ctx.translate(trackerX, 85);
      
      // Fondo rojo parpadeante
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-50, -14, 100, 28, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Texto del radar
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`👹 YETI ⬇️ ${distM}m`, 0, 0);
      
      ctx.restore();
    }
  }

  // 6. Efecto de nieve de fondo decorativa (clima)
  drawWeatherSnow();

  // 7. Contador de FPS — centro inferior del canvas (zona siempre libre de botones)
  if (_showFps) {
    const fps = _fpsDisplay;
    const fpsColor = fps >= 55 ? '#22c55e' : fps >= 28 ? '#fbbf24' : '#ef4444';
    const fpsText = `${fps} FPS`;
    const fx = width / 2;
    const fy = height - 18;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(fx - 36, fy - 11, 72, 22, 6);
    ctx.fill();
    ctx.fillStyle = fpsColor;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fpsText, fx, fy);
    ctx.restore();
  }
}

// ==========================================================================
// DIBUJO SIMPLIFICADO PARA MOBILE (mínimas operaciones canvas por obstáculo)
// ==========================================================================
function drawObstacleSimple(x, y, obs) {
  if (obs.collected) return;
  ctx.save();
  ctx.translate(x, y);

  switch (obs.type) {
    case OBSTACLE_TYPES.TREE: {
      // Árbol: tronco + triángulo verde simple
      ctx.fillStyle = '#5a2d0c';
      ctx.fillRect(-3, -2, 6, obs.size * 0.35);
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.moveTo(0, -obs.size * 0.9);
      ctx.lineTo(-obs.size * 0.5, 0);
      ctx.lineTo(obs.size * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case OBSTACLE_TYPES.ROCK: {
      // Roca: polígono gris simple
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.5, 0);
      ctx.lineTo(-obs.size * 0.3, -obs.size * 0.55);
      ctx.lineTo(obs.size * 0.3, -obs.size * 0.55);
      ctx.lineTo(obs.size * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      // Nieve encima
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.ellipse(0, -obs.size * 0.5, obs.size * 0.3, obs.size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case OBSTACLE_TYPES.SNOWMAN: {
      // Muñeco: 3 círculos apilados
      ctx.fillStyle = '#f0f4f8';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -13, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -22, 5, 0, Math.PI * 2); ctx.fill();
      // Ojos
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(-2, -23, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2, -23, 1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case OBSTACLE_TYPES.COIN: {
      // Moneda: elipse giratoria simple
      obs.rot = (obs.rot || 0) + 0.06;
      const coinScale = Math.abs(Math.cos(obs.rot)) * 0.45 + 0.55;
      const cw = obs.size * 0.5 * coinScale;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(0, -4, cw + 1.5, obs.size * 0.5 + 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(0, -4, cw * 0.6, obs.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case OBSTACLE_TYPES.SHIELD: {
      obs.floatOffset = (obs.floatOffset || 0) + 0.05;
      const fy = Math.sin(obs.floatOffset) * 3 - 6;
      ctx.fillStyle = 'rgba(0, 243, 255, 0.35)';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, fy, obs.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', 0, fy);
      break;
    }
    case OBSTACLE_TYPES.MAGNET: {
      obs.floatOffset = (obs.floatOffset || 0) + 0.05;
      const fy = Math.sin(obs.floatOffset) * 3 - 6;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, fy, obs.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧲', 0, fy);
      break;
    }
    case OBSTACLE_TYPES.RAMP: {
      // Rampa: triángulo cian simple
      ctx.fillStyle = 'rgba(0, 243, 255, 0.25)';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.6, 0);
      ctx.lineTo(0, -obs.size * 0.35);
      ctx.lineTo(obs.size * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

// Dibuja obstáculo específico en Canvas con mejoras visuales HD
function drawObstacle(x, y, obs) {
  ctx.save();
  ctx.translate(x, y);

  switch (obs.type) {
    case OBSTACLE_TYPES.TREE: {
      // -------------------------------------------------------------
      // 🌲 PINO NEVADO HD CON SOMBRA 3D
      // -------------------------------------------------------------
      // Sombra en el suelo
      ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
      ctx.beginPath();
      ctx.ellipse(obs.size * 0.2, 4, obs.size * 0.45, obs.size * 0.16, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Tronco con textura y sombra
      ctx.fillStyle = '#582d0d';
      ctx.fillRect(-obs.size * 0.08, -2, obs.size * 0.16, obs.size * 0.4);
      ctx.fillStyle = '#3d1e08';
      ctx.fillRect(0, -2, obs.size * 0.08, obs.size * 0.4);

      // 4 Capas de ramas estilizadas
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const factor = (layers - i) / layers;
        const w = obs.size * 0.55 * factor;
        const h = obs.size * 0.38;
        const offsetY = -obs.size * 0.22 * i;

        // Degradado de verde según profundidad
        ctx.fillStyle = i === 0 ? '#064e3b' : i === 1 ? '#047857' : i === 2 ? '#10b981' : '#34d399';

        ctx.beginPath();
        ctx.moveTo(0, offsetY - h);
        ctx.lineTo(-w, offsetY);
        ctx.lineTo(w, offsetY);
        ctx.closePath();
        ctx.fill();

        // Sombra propia en el lado derecho de la rama
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.beginPath();
        ctx.moveTo(0, offsetY - h);
        ctx.lineTo(0, offsetY);
        ctx.lineTo(w, offsetY);
        ctx.closePath();
        ctx.fill();

        // Nieve esponjosa sobre las ramas
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(0, offsetY - h);
        ctx.lineTo(-w * 0.35, offsetY - h * 0.6);
        ctx.quadraticCurveTo(-w * 0.1, offsetY - h * 0.4, 0, offsetY - h * 0.5);
        ctx.quadraticCurveTo(w * 0.1, offsetY - h * 0.4, w * 0.35, offsetY - h * 0.6);
        ctx.closePath();
        ctx.fill();
      }

      // Estrella / Copo en la punta (variante 1)
      if (obs.variant === 1) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, -obs.size * 0.95, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case OBSTACLE_TYPES.ROCK: {
      // -------------------------------------------------------------
      // 🪨 ROCA / BLOQUE DE HIELO CON FACETAS POLIGONALES
      // -------------------------------------------------------------
      // Sombra
      ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
      ctx.beginPath();
      ctx.ellipse(obs.size * 0.1, 2, obs.size * 0.5, obs.size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cuerpo base de la roca (polígono facetado)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.5, 0);
      ctx.lineTo(-obs.size * 0.4, -obs.size * 0.4);
      ctx.lineTo(-obs.size * 0.1, -obs.size * 0.65);
      ctx.lineTo(obs.size * 0.3, -obs.size * 0.6);
      ctx.lineTo(obs.size * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      // Faceta clara de luz (izquierda)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.5, 0);
      ctx.lineTo(-obs.size * 0.4, -obs.size * 0.4);
      ctx.lineTo(-obs.size * 0.1, -obs.size * 0.65);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Faceta media (centro)
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.1, -obs.size * 0.65);
      ctx.lineTo(obs.size * 0.3, -obs.size * 0.6);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Veta de cristal de hielo brillante
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.2, -obs.size * 0.5);
      ctx.lineTo(-obs.size * 0.05, -obs.size * 0.2);
      ctx.stroke();

      // Acumulación de nieve encima
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.35, -obs.size * 0.45);
      ctx.quadraticCurveTo(-obs.size * 0.1, -obs.size * 0.75, obs.size * 0.25, -obs.size * 0.55);
      ctx.quadraticCurveTo(0, -obs.size * 0.45, -obs.size * 0.35, -obs.size * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case OBSTACLE_TYPES.SNOWMAN: {
      // -------------------------------------------------------------
      // ⛄ MUÑECO DE NIEVE
      // -------------------------------------------------------------
      if (obs.collected) break;

      // Sombra
      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bola inferior (grande)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath(); ctx.arc(3, 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-2, -2, 9, 0, Math.PI * 2); ctx.fill();

      // Bola media
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.arc(0, -12, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath(); ctx.arc(2, -11, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-1.5, -13, 6.5, 0, Math.PI * 2); ctx.fill();

      // Bola superior (cabeza)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, -22, 6, 0, Math.PI * 2); ctx.fill();

      // Botones de carbón
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(0, -14, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -10, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -2, 1.4, 0, Math.PI * 2); ctx.fill();

      // Ojos
      ctx.beginPath(); ctx.arc(-2, -23, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2, -23, 1, 0, Math.PI * 2); ctx.fill();

      // Nariz de zanahoria 🥕
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(0, -21.5);
      ctx.lineTo(6, -20.5);
      ctx.lineTo(0, -19.5);
      ctx.closePath();
      ctx.fill();

      // Bufanda roja
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-6.5, -17, 13, 3.5, 1.5);
      ctx.fill();
      ctx.fillRect(2, -15, 3.5, 7);

      // Gorro de copa
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-7, -27, 14, 2);
      ctx.fillRect(-4.5, -34, 9, 7);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-4.5, -28.5, 9, 1.5);
      break;
    }

    case OBSTACLE_TYPES.COIN: {
      // -------------------------------------------------------------
      // 🪙 MONEDA DORADA 3D GIRATORIA
      // -------------------------------------------------------------
      if (obs.collected) break;
      obs.rot = (obs.rot || 0) + 0.06;
      const coinScale = Math.abs(Math.cos(obs.rot)) * 0.45 + 0.55;
      const coinW = obs.size * 0.5 * coinScale;

      // Glow simulado sin ctx.shadow (rendimiento móvil)
      ctx.fillStyle = 'rgba(255, 173, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, -4, coinW + 5, obs.size * 0.5 + 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Anillo exterior
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(0, -4, coinW + 1.5, obs.size * 0.5 + 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Moneda dorada
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(0, -4, coinW, obs.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Centro brillante
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(0, -4, coinW * 0.7, obs.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Símbolo "$"
      if (coinScale > 0.55) {
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, -4);
      }
      break;
    }

    case OBSTACLE_TYPES.SHIELD: {
      // -------------------------------------------------------------
      // 🛡️ ORBE NEÓN DE ESCUDO FLOTANTE
      // -------------------------------------------------------------
      if (obs.collected) break;
      obs.floatOffset = (obs.floatOffset || 0) + 0.05;
      const floatY = Math.sin(obs.floatOffset) * 3 - 6;

      // Glow simulado (halo exterior, sin ctx.shadow)
      ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(0, floatY, obs.size * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Orbe exterior
      ctx.fillStyle = 'rgba(0, 243, 255, 0.18)';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, floatY, obs.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Anillo giratorio
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, floatY, obs.size * 0.7, obs.size * 0.25, obs.floatOffset, 0, Math.PI * 2);
      ctx.stroke();

      // Ícono de escudo
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', 0, floatY);
      break;
    }

    case OBSTACLE_TYPES.MAGNET: {
      // -------------------------------------------------------------
      // 🧲 ORBE NEÓN DE IMÁN FLOTANTE
      // -------------------------------------------------------------
      if (obs.collected) break;
      obs.floatOffset = (obs.floatOffset || 0) + 0.05;
      const floatY = Math.sin(obs.floatOffset) * 3 - 6;

      // Glow simulado (halo exterior, sin ctx.shadow)
      ctx.fillStyle = 'rgba(192, 132, 252, 0.15)';
      ctx.beginPath();
      ctx.arc(0, floatY, obs.size * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Orbe exterior
      ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, floatY, obs.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Anillo giratorio
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, floatY, obs.size * 0.7, obs.size * 0.25, -obs.floatOffset, 0, Math.PI * 2);
      ctx.stroke();

      // Ícono de imán
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧲', 0, floatY);
      break;
    }

    case OBSTACLE_TYPES.RAMP: {
      // -------------------------------------------------------------
      // 🚀 RAMPA DE SALTO ESCULPIDA PRO
      // -------------------------------------------------------------
      // Sombra en la nieve
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.65, 2);
      ctx.lineTo(obs.size * 0.65, 2);
      ctx.lineTo(obs.size * 0.45, -obs.size * 0.35);
      ctx.lineTo(-obs.size * 0.45, -obs.size * 0.35);
      ctx.closePath();
      ctx.fill();

      // Rampa principal (nieve moldeada) — sin shadowColor para rendimiento móvil
      ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.6, 0);
      ctx.lineTo(-obs.size * 0.4, -obs.size * 0.35);
      ctx.lineTo(obs.size * 0.4, -obs.size * 0.35);
      ctx.lineTo(obs.size * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Borde de despegue (neón)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.42, -obs.size * 0.35);
      ctx.lineTo(obs.size * 0.42, -obs.size * 0.35);
      ctx.stroke();

      // Flechas iluminadas
      ctx.fillStyle = '#00f3ff';
      for (let j = 0; j < 2; j++) {
        const offset = -j * 7;
        ctx.beginPath();
        ctx.moveTo(0, 3 + offset);
        ctx.lineTo(-4.5, 7 + offset);
        ctx.lineTo(4.5, 7 + offset);
        ctx.closePath();
        ctx.fill();
      }

      // Banderines de slalom a los lados
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.55, 0); ctx.lineTo(-obs.size * 0.55, -16);
      ctx.moveTo(obs.size * 0.55, 0); ctx.lineTo(obs.size * 0.55, -16);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-obs.size * 0.55, -16); ctx.lineTo(-obs.size * 0.55 - 8, -13); ctx.lineTo(-obs.size * 0.55, -10);
      ctx.moveTo(obs.size * 0.55, -16); ctx.lineTo(obs.size * 0.55 + 8, -13); ctx.lineTo(obs.size * 0.55, -10);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// Dibuja al esquiador
function drawPlayer(x, y) {
  if (isNaN(x) || !isFinite(x) || isNaN(y) || !isFinite(y)) return;
  ctx.save();
  
  // Animación dinámica de bamboleo al esquiar/deslizarse
  player.animFrame = (player.animFrame || 0) + 0.18;
  const wobbleY = (gameState === STATES.PLAYING) ? Math.sin(player.animFrame) * 1.6 : 0;
  
  ctx.translate(x, y + wobbleY);

  // Rotación de truco 360° en el aire durante el salto
  if (gameState === STATES.JUMPING) {
    const jumpProgress = player.jumpAirTime / player.jumpDuration;
    const spinAngle = jumpProgress * Math.PI * 2;
    ctx.rotate(spinAngle);
    ctx.scale(player.jumpScale, player.jumpScale);
  }

  // Efecto de parpadeo por invulnerabilidad (crashCooldown)
  if (player.crashCooldown > 0 && Math.floor(player.crashCooldown / 6) % 2 === 0) {
    ctx.restore();
    return;
  }

  // Escalar en base al salto
  ctx.scale(player.jumpScale, player.jumpScale);
  
  // Inclinación visual + Giro 360 en el aire si está saltando
  let currentAngle = player.angle;
  if (gameState === STATES.JUMPING) {
    const jumpProgress = player.jumpAirTime / player.jumpDuration;
    currentAngle += jumpProgress * Math.PI * 2; // ¡Pirueta 360 en el aire!
  }
  ctx.rotate(currentAngle);

  // Sombra proyectada del esquiador si está en salto
  if (gameState === STATES.JUMPING) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 18 / player.jumpScale, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Detección de tema de Skin activa
  const activeSkin = playerProfile.activeSkin || 'default';

  // Efecto de partículas pasivas para Skins especiales
  if (activeSkin === 'fire' && Math.random() < 0.5) {
    spawnParticle(x + (Math.random() * 12 - 6), y + 10, '#f97316', 2.5, Math.random() * 2 - 1, Math.random() * 2 + 1);
  } else if (activeSkin === 'yeti_gold' && Math.random() < 0.3) {
    spawnParticle(x + (Math.random() * 12 - 6), y + 10, '#eab308', 2.5, Math.random() * 2 - 1, Math.random() * 2 + 1);
  }

  // Partículas de nieve al girar (mejorado para ambos personajes)
  if (gameState === STATES.PLAYING && Math.abs(player.speedX) > 1.5 && Math.random() < 0.6) {
    const sprayDir = player.speedX > 0 ? -1 : 1;
    spawnParticle(x + sprayDir * 8, y + 12, '#e2e8f0', 1.5 + Math.random(), sprayDir * (1 + Math.random()), -Math.random() * 2);
    if (Math.random() < 0.3) {
      spawnParticle(x + sprayDir * 6, y + 10, '#cbd5e1', 1 + Math.random(), sprayDir * (0.5 + Math.random()), -Math.random() * 1.5);
    }
  }

  // Campo de Fuerza / Escudo Neón Activo 🛡️ (Cápsula ovalada que envuelve todo el personaje)
  if (player.hasShield) {
    ctx.save();
    const shieldPulse = Math.sin((player.animFrame || 0) * 0.15) * 1.5;
    const centerY = 8;
    const rx = 21 + shieldPulse * 0.5;
    const ry = 28 + shieldPulse;

    ctx.shadowColor = '#00f3ff';

    // Relleno de energía con degradado radial
    const gradient = ctx.createRadialGradient(0, centerY, 4, 0, centerY, ry);
    gradient.addColorStop(0, 'rgba(0, 243, 255, 0.04)');
    gradient.addColorStop(0.7, 'rgba(0, 243, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 243, 255, 0.35)');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.ellipse(0, centerY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Borde brillante de neón
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, centerY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Anillo de brillo interno
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, centerY, rx - 3, ry - 3, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // Aura especial visual según la Skin activa (se dibuja detrás del personaje)
  if (activeSkin === 'fire') {
    ctx.save();
    ctx.strokeStyle = '#ea580c';
    ctx.fillStyle = 'rgba(234, 88, 12, 0.22)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 8, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.35) {
      spawnParticle(x + (Math.random() * 16 - 8), y + 10, '#f97316', 3, (Math.random() - 0.5) * 2, Math.random() * 2 + 1);
    }
  } else if (activeSkin === 'cyber') {
    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 8, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.35) {
      spawnParticle(x + (Math.random() * 16 - 8), y + 10, '#00f3ff', 2.5, (Math.random() - 0.5) * 3, Math.random() * 2 + 1);
    }
  } else if (activeSkin === 'yeti_gold') {
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 8, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.35) {
      spawnParticle(x + (Math.random() * 16 - 8), y + 8, '#fbbf24', 3, (Math.random() - 0.5) * 2, -Math.random() * 2);
    }
  }

  if (selectedChar === 'BOARDER') {
    // =================================================================
    // SNOWBOARDER — Retro Sprite Mejorado (Estilo Arcade 80s/90s)
    // =================================================================
    const turnState = player.speedX < -0.35 ? 'LEFT' : (player.speedX > 0.35 ? 'RIGHT' : 'FRONT');
    const turnIntensity = Math.abs(player.speedX) / player.maxSpeedX; // 0..1
    const speedRatio = player.speedY / player.maxSpeedY; // 0..1

    // Sombra dinámica en el suelo (contacto perfecto bajo la tabla)
    const shadowScaleX = 16 + turnIntensity * 5;
    const shadowScaleY = 4.5 - turnIntensity * 1.0;
    const shadowOffsetX = (player.speedX / player.maxSpeedX) * 3;
    ctx.fillStyle = `rgba(15, 23, 42, ${0.14 + speedRatio * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(shadowOffsetX, 22, shadowScaleX, shadowScaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Seleccionar pose direccional 100% individual y limpia
    let retroImg;
    if (selectedStyle === 'BANANA') {
      if (turnState === 'LEFT') retroImg = bananaBoarderLeftImg;
      else if (turnState === 'RIGHT') retroImg = bananaBoarderRightImg;
      else retroImg = bananaBoarderDownImg;
    } else {
      if (turnState === 'LEFT') retroImg = humanBoarderLeftImg;
      else if (turnState === 'RIGHT') retroImg = humanBoarderRightImg;
      else retroImg = humanBoarderDownImg;
    }

    let drawn = false;
    const imgW = retroImg ? (retroImg.naturalWidth || retroImg.width || 0) : 0;
    const imgH = retroImg ? (retroImg.naturalHeight || retroImg.height || 0) : 0;

    if (imgW > 0) {
      // Tamaño óptimo para celular y PC (+10% escala, 66px)
      const sprH = 66;
      const sprW = 66;

      // Inclinación corporal al girar (lean)
      const leanAngle = (player.speedX / player.maxSpeedX) * 0.18;

      // Micro-bobbing vertical con la velocidad
      const bobFreq = 0.22 + speedRatio * 0.12;
      const bobAmp = 0.8 + speedRatio * 1.0;
      const microBob = Math.sin(player.animFrame * bobFreq * 6) * bobAmp;

      // Squash-stretch al aterrizar de un salto
      let squashX = 1, squashY = 1;
      if (player._landingTimer && player._landingTimer > 0) {
        const t = player._landingTimer / 8;
        squashX = 1 + t * 0.15;
        squashY = 1 - t * 0.12;
        player._landingTimer--;
      }

      // --- Afterimage trail retro (estela tipo 80s/90s) ---
      if (gameState === STATES.PLAYING && turnIntensity > 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.15 + turnIntensity * 0.1;
        const trailOffX = -(player.speedX * 0.6);
        const trailOffY = 2;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          retroImg,
          0, 0, imgW, imgH,
          -sprW / 2 + trailOffX, -sprH / 2 + 13 + trailOffY + microBob, sprW, sprH
        );
        ctx.restore();
      }

      // --- Dibujar sprite principal con crispy pixels y carving dinámico ---
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.rotate(leanAngle);
      ctx.scale(squashX, squashY);
      ctx.drawImage(
        retroImg,
        0, 0, imgW, imgH,
        -sprW / 2, -sprH / 2 + 13 + microBob, sprW, sprH
      );

      // Corona Real Dorada para Skin Yeti Dorado
      if (activeSkin === 'yeti_gold') {
        const crownBob = Math.sin((player.animFrame || 0) * 0.18) * 2;
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, -24 + crownBob); ctx.lineTo(-9, -31 + crownBob); ctx.lineTo(-5, -27 + crownBob);
        ctx.lineTo(0, -33 + crownBob); ctx.lineTo(5, -27 + crownBob); ctx.lineTo(9, -31 + crownBob); ctx.lineTo(9, -24 + crownBob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-1, -30 + crownBob, 2, 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-7, -28 + crownBob, 2, 2);
        ctx.fillRect(5, -28 + crownBob, 2, 2);
      }

      ctx.restore();

      // --- Spray de nieve retro al girar fuerte ---
      if (gameState === STATES.PLAYING && turnIntensity > 0.4 && Math.random() < 0.7) {
        const dir = player.speedX > 0 ? -1 : 1;
        for (let s = 0; s < 2; s++) {
          spawnParticle(
            x + dir * (10 + Math.random() * 6), y + 18 + Math.random() * 4,
            Math.random() < 0.5 ? '#e2e8f0' : '#f1f5f9',
            1.5 + Math.random() * 1.5,
            dir * (1.5 + Math.random() * 2), -(0.5 + Math.random() * 1.5)
          );
        }
      }

      drawn = true;
    }

    if (!drawn) {
      // Fallback a los vectores originales de la tabla
      let boardTilt = player.speedX / player.maxSpeedX * 0.15;
      if (turnState === 'LEFT') boardTilt -= 0.1;
      if (turnState === 'RIGHT') boardTilt += 0.1;

      ctx.save();
      ctx.rotate(boardTilt);

      // Tabla principal
      ctx.fillStyle = activeSkin === 'cyber' ? '#0ea5e9' : '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-18, 12, 36, 6, 3);
      ctx.fill();

      // Diseño de la tabla
      ctx.strokeStyle = activeSkin === 'cyber' ? '#00f3ff' : activeSkin === 'fire' ? '#f97316' : '#e11d48';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, 15); ctx.lineTo(14, 15);
      ctx.stroke();

      // Fijaciones (bindings)
      ctx.fillStyle = '#334155';
      ctx.fillRect(-8, 11, 5, 3);
      ctx.fillRect(3, 11, 5, 3);

      // Borde luminoso de la tabla
      ctx.strokeStyle = activeSkin === 'cyber' ? 'rgba(0, 243, 255, 0.6)' : activeSkin === 'fire' ? 'rgba(249, 115, 22, 0.5)' : 'rgba(225, 29, 72, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-18, 12, 36, 6, 3);
      ctx.stroke();
      ctx.restore();

      // --- PIERNAS (postura lateral adaptada al giro) ---
      ctx.fillStyle = '#1e3a5f';
      let legOffset = 0;
      if (turnState === 'LEFT') legOffset = -2;
      if (turnState === 'RIGHT') legOffset = 2;

      // Pierna trasera
      ctx.beginPath();
      ctx.moveTo(-5 + legOffset, 4); ctx.lineTo(-8 + legOffset, 12); ctx.lineTo(-3 + legOffset, 12); ctx.lineTo(-1 + legOffset, 4);
      ctx.closePath();
      ctx.fill();
      // Pierna delantera
      ctx.beginPath();
      ctx.moveTo(2 + legOffset, 4); ctx.lineTo(4 + legOffset, 12); ctx.lineTo(9 + legOffset, 12); ctx.lineTo(6 + legOffset, 4);
      ctx.closePath();
      ctx.fill();

      // --- TORSO / CHAQUETA (inclinado según dirección) ---
      const jacketColor = activeSkin === 'fire' ? '#dc2626' : activeSkin === 'cyber' ? '#0284c7' : '#7c3aed';
      const jacketHighlight = activeSkin === 'fire' ? '#f87171' : activeSkin === 'cyber' ? '#38bdf8' : '#a78bfa';
      
      ctx.save();
      if (turnState === 'LEFT') ctx.translate(-2, 0);
      if (turnState === 'RIGHT') ctx.translate(2, 0);

      ctx.fillStyle = jacketColor;
      ctx.beginPath();
      ctx.roundRect(-9, -10, 18, 16, 4);
      ctx.fill();

      // Franja decorativa en la chaqueta
      ctx.fillStyle = jacketHighlight;
      ctx.beginPath();
      ctx.roundRect(-9, -3, 18, 3, 1);
      ctx.fill();

      // Cremallera (desplazada según vista)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      let zipX = 0;
      if (turnState === 'LEFT') zipX = -2;
      if (turnState === 'RIGHT') zipX = 2;
      ctx.beginPath();
      ctx.moveTo(zipX, -9); ctx.lineTo(zipX, 5);
      ctx.stroke();
      ctx.restore();

      // --- BRAZOS (balanceo dinámico) ---
      ctx.fillStyle = jacketColor;
      const armSwing = Math.sin(player.animFrame * 0.8) * 3;
      
      // Brazo izquierdo
      ctx.save();
      ctx.translate(-9, -6);
      if (turnState === 'LEFT') {
        ctx.rotate(-0.6 + armSwing * 0.05);
      } else if (turnState === 'RIGHT') {
        ctx.rotate(0.1 + armSwing * 0.05);
      } else {
        ctx.rotate(-0.3 + armSwing * 0.05);
      }
      ctx.fillRect(-3, 0, 5, 12);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(-0.5, 12, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      
      // Brazo derecho
      ctx.fillStyle = jacketColor;
      ctx.save();
      ctx.translate(9, -6);
      if (turnState === 'LEFT') {
        ctx.rotate(-0.1 - armSwing * 0.05);
      } else if (turnState === 'RIGHT') {
        ctx.rotate(0.6 - armSwing * 0.05);
      } else {
        ctx.rotate(0.3 - armSwing * 0.05);
      }
      ctx.fillRect(-2, 0, 5, 12);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(0.5, 12, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // --- CABEZA Y ACCESORIOS (mirando a la dirección del giro) ---
      ctx.save();
      let headX = 0;
      if (turnState === 'LEFT') headX = -3;
      if (turnState === 'RIGHT') headX = 3;
      ctx.translate(headX, 0);

      // Cuello / bufanda
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-4, -13, 8, 4);

      // Cabeza base (piel)
      ctx.fillStyle = '#fbbf80';
      ctx.beginPath();
      ctx.arc(0, -18, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Gorro / beanie
      const hatColor = activeSkin === 'fire' ? '#b91c1c' : activeSkin === 'cyber' ? '#0e7490' : '#5b21b6';
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.arc(0, -19, 7.5, Math.PI, 0, false);
      ctx.fill();
      ctx.fillRect(-7.5, -19, 15, 2);

      // Doblez del gorro
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-7, -19, 14, 2.5);

      // Pompón del gorro
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.arc(0, -26, 3, 0, Math.PI * 2);
      ctx.fill();

      // Goggles / Antiparras (desplazadas según a donde mira)
      ctx.fillStyle = '#0f172a';
      let gogX = 0;
      if (turnState === 'LEFT') gogX = -2;
      if (turnState === 'RIGHT') gogX = 2;

      ctx.beginPath();
      ctx.roundRect(-6.5 + gogX, -21, 13, 5, 2.5);
      ctx.fill();

      // Reflejo en las goggles
      ctx.fillStyle = activeSkin === 'cyber' ? '#22d3ee' : activeSkin === 'fire' ? '#fbbf24' : '#c084fc';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.roundRect(-5.5 + gogX, -20.5, 5, 3.5, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(1 + gogX, -20.5, 5, 3.5, 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Boca
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (turnState === 'LEFT') {
        ctx.arc(-1, -14.5, 2.5, 0.1 * Math.PI, 0.9 * Math.PI, false);
      } else if (turnState === 'RIGHT') {
        ctx.arc(1, -14.5, 2.5, 0.1 * Math.PI, 0.9 * Math.PI, false);
      } else {
        ctx.arc(0, -14.5, 3, 0.1 * Math.PI, 0.9 * Math.PI, false);
      }
      ctx.stroke();
      ctx.restore();
    }

  } else {
    // =================================================================
    // ESQUIADOR — Retro Sprite Mejorado (Estilo Arcade 80s/90s)
    // =================================================================
    const turnState = player.speedX < -0.35 ? 'LEFT' : (player.speedX > 0.35 ? 'RIGHT' : 'FRONT');
    const turnIntensity = Math.abs(player.speedX) / player.maxSpeedX; // 0..1
    const speedRatio = player.speedY / player.maxSpeedY; // 0..1

    // Sombra dinámica en el suelo (contacto perfecto bajo los esquís)
    const shadowScaleX = 14 + turnIntensity * 5;
    const shadowScaleY = 4 - turnIntensity * 1.2;
    const shadowOffsetX = (player.speedX / player.maxSpeedX) * 3;
    ctx.fillStyle = `rgba(15, 23, 42, ${0.12 + speedRatio * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(shadowOffsetX, 22, shadowScaleX, shadowScaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    const retroImg = selectedStyle === 'BANANA' ? retroBananaSkierImg : retroHumanSkierImg;
    let drawn = false;

    const imgW = retroImg.naturalWidth || retroImg.width || 0;
    const imgH = retroImg.naturalHeight || retroImg.height || 0;

    if (imgW > 0) {
      const frameWidth = imgW / 3;
      const frameHeight = imgH;
      
      let frameIndex = 1; // Center (Front)
      let flipX = 1;

      if (selectedStyle === 'BANANA') {
        if (turnState === 'LEFT') {
          frameIndex = 2; // Cuadro lateral
          flipX = -1; // FLIP horizontal para que mire 100% a la izquierda
        } else if (turnState === 'RIGHT') {
          frameIndex = 2; // Cuadro lateral
          flipX = 1; // Normal a la derecha
        } else {
          frameIndex = 1; // Frontal
          flipX = 1;
        }
      } else {
        if (turnState === 'LEFT') {
          frameIndex = 0;
          flipX = 1;
        } else if (turnState === 'RIGHT') {
          frameIndex = 2;
          flipX = 1;
        } else {
          frameIndex = 1;
          flipX = 1;
        }
      }

      // Tamaño +10% (64px)
      const frameAspect = frameWidth / frameHeight;
      const sprH = 64;
      const sprW = sprH * frameAspect;

      // Inclinación corporal al girar (lean)
      const leanAngle = (player.speedX / player.maxSpeedX) * 0.15;

      // Micro-bobbing vertical con la velocidad
      const bobFreq = 0.22 + speedRatio * 0.12;
      const bobAmp = 0.8 + speedRatio * 1.0;
      const microBob = Math.sin(player.animFrame * bobFreq * 6) * bobAmp;

      // Squash-stretch al aterrizar de un salto
      let squashX = 1, squashY = 1;
      if (player._landingTimer && player._landingTimer > 0) {
        const t = player._landingTimer / 8;
        squashX = 1 + t * 0.15;
        squashY = 1 - t * 0.12;
        player._landingTimer--;
      }

      // --- Afterimage trail retro (estela tipo 80s/90s) ---
      if (gameState === STATES.PLAYING && turnIntensity > 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.15 + turnIntensity * 0.1;
        const trailOffX = -(player.speedX * 0.6);
        const trailOffY = 2;
        ctx.imageSmoothingEnabled = false;
        ctx.scale(flipX, 1);
        ctx.drawImage(
          retroImg,
          frameIndex * frameWidth, 0, frameWidth, frameHeight,
          (-sprW / 2) * flipX + trailOffX, -sprH / 2 + 13 + trailOffY + microBob, sprW * flipX, sprH
        );
        ctx.restore();
      }

      // --- Dibujar sprite principal con crispy pixels y flip horizontal ---
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.rotate(leanAngle);
      ctx.scale(squashX * flipX, squashY);
      ctx.drawImage(
        retroImg,
        frameIndex * frameWidth, 0, frameWidth, frameHeight,
        -sprW / 2, -sprH / 2 + 13 + microBob, sprW, sprH
      );

      // Corona Real Dorada para Skin Yeti Dorado
      if (activeSkin === 'yeti_gold') {
        const crownBob = Math.sin((player.animFrame || 0) * 0.18) * 2;
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, -24 + crownBob); ctx.lineTo(-9, -31 + crownBob); ctx.lineTo(-5, -27 + crownBob);
        ctx.lineTo(0, -33 + crownBob); ctx.lineTo(5, -27 + crownBob); ctx.lineTo(9, -31 + crownBob); ctx.lineTo(9, -24 + crownBob);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-1, -30 + crownBob, 2, 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-7, -28 + crownBob, 2, 2);
        ctx.fillRect(5, -28 + crownBob, 2, 2);
      }

      ctx.restore();

      // --- Spray de nieve retro al girar fuerte ---
      if (gameState === STATES.PLAYING && turnIntensity > 0.4 && Math.random() < 0.7) {
        const dir = player.speedX > 0 ? -1 : 1;
        for (let s = 0; s < 2; s++) {
          spawnParticle(
            x + dir * (10 + Math.random() * 6), y + 18 + Math.random() * 4,
            Math.random() < 0.5 ? '#e2e8f0' : '#f1f5f9',
            1.5 + Math.random() * 1.5,
            dir * (1.5 + Math.random() * 2), -(0.5 + Math.random() * 1.5)
          );
        }
      }

      drawn = true;
    }

    if (!drawn) {
      // Fallback a los vectores originales si no cargó el sprite o es skin especial
      // --- ESQUÍS ---
      const skiTilt = player.speedX / player.maxSpeedX * 0.12;
      ctx.save();
      ctx.rotate(skiTilt);

      let leftSkiX = -10;
      let rightSkiX = 7;
      if (turnState === 'LEFT') {
        leftSkiX = -8;
        rightSkiX = 4;
      } else if (turnState === 'RIGHT') {
        leftSkiX = -4;
        rightSkiX = 8;
      }

      // Esquí izquierdo
      ctx.fillStyle = activeSkin === 'fire' ? '#dc2626' : activeSkin === 'cyber' ? '#0284c7' : '#1e40af';
      ctx.beginPath();
      ctx.roundRect(leftSkiX, 10, 3, 22, 1.5);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftSkiX + 1.5, 10, 1.5, Math.PI, 0, false);
      ctx.fill();

      // Esquí derecho
      ctx.beginPath();
      ctx.roundRect(rightSkiX, 10, 3, 22, 1.5);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightSkiX + 1.5, 10, 1.5, Math.PI, 0, false);
      ctx.fill();

      // Borde brillante de los esquís
      ctx.strokeStyle = activeSkin === 'fire' ? '#fbbf24' : activeSkin === 'cyber' ? '#00f3ff' : '#60a5fa';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(leftSkiX, 10, 3, 22, 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(rightSkiX, 10, 3, 22, 1.5);
      ctx.stroke();
      ctx.restore();

      // --- BOTAS ---
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(leftSkiX, 10, 6, 5);
      ctx.fillRect(rightSkiX, 10, 6, 5);

      // --- PIERNAS (pantalón de esquí) ---
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.moveTo(leftSkiX + 3, 4); ctx.lineTo(leftSkiX + 1, 11); ctx.lineTo(leftSkiX + 6, 11); ctx.lineTo(leftSkiX + 7, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rightSkiX - 4, 4); ctx.lineTo(rightSkiX - 3, 11); ctx.lineTo(rightSkiX + 2, 11); ctx.lineTo(rightSkiX + 4, 4);
      ctx.closePath();
      ctx.fill();

      // --- TORSO / CHAQUETA ---
      const skierJacketColor = activeSkin === 'fire' ? '#dc2626' : activeSkin === 'cyber' ? '#0284c7' : '#2563eb';
      const skierJacketHighlight = activeSkin === 'fire' ? '#f87171' : activeSkin === 'cyber' ? '#38bdf8' : '#93c5fd';

      ctx.save();
      if (turnState === 'LEFT') ctx.translate(-1.5, 0);
      if (turnState === 'RIGHT') ctx.translate(1.5, 0);

      ctx.fillStyle = skierJacketColor;
      ctx.beginPath();
      ctx.roundRect(-8, -10, 16, 16, 3);
      ctx.fill();

      // Franja de la chaqueta
      ctx.fillStyle = skierJacketHighlight;
      ctx.beginPath();
      ctx.roundRect(-8, -2, 16, 2.5, 1);
      ctx.fill();

      // Cremallera central (desplazada según giro)
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.8;
      let sZipX = 0;
      if (turnState === 'LEFT') sZipX = -1.5;
      if (turnState === 'RIGHT') sZipX = 1.5;
      ctx.beginPath();
      ctx.moveTo(sZipX, -9); ctx.lineTo(sZipX, 5);
      ctx.stroke();
      ctx.restore();

      // --- BRAZOS CON BASTONES ---
      ctx.fillStyle = skierJacketColor;
      const poleSwing = Math.sin(player.animFrame * 1.2) * 4;

      // Brazo izquierdo (con bastón)
      ctx.save();
      ctx.translate(-8, -6);
      if (turnState === 'LEFT') {
        ctx.rotate(-0.55 + poleSwing * 0.04);
      } else if (turnState === 'RIGHT') {
        ctx.rotate(-0.1 + poleSwing * 0.04);
      } else {
        ctx.rotate(-0.4 + poleSwing * 0.04);
      }
      ctx.fillRect(-3, 0, 5, 11);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(-0.5, 11, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-0.5, 11); ctx.lineTo(-2, 28);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.beginPath(); ctx.arc(-2, 28, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Brazo derecho (con bastón)
      ctx.fillStyle = skierJacketColor;
      ctx.save();
      ctx.translate(8, -6);
      if (turnState === 'LEFT') {
        ctx.rotate(0.1 - poleSwing * 0.04);
      } else if (turnState === 'RIGHT') {
        ctx.rotate(0.55 - poleSwing * 0.04);
      } else {
        ctx.rotate(0.4 - poleSwing * 0.04);
      }
      ctx.fillRect(-2, 0, 5, 11);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(0.5, 11, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0.5, 11); ctx.lineTo(2, 28);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.beginPath(); ctx.arc(2, 28, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // --- CABEZA ---
      ctx.save();
      let sHeadX = 0;
      if (turnState === 'LEFT') sHeadX = -2;
      if (turnState === 'RIGHT') sHeadX = 2;
      ctx.translate(sHeadX, 0);

      // Cuello
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-3.5, -13, 7, 4);

      // Cabeza base
      ctx.fillStyle = '#fbbf80';
      ctx.beginPath();
      ctx.arc(0, -18, 7, 0, Math.PI * 2);
      ctx.fill();

      // Casco
      const helmetColor = activeSkin === 'fire' ? '#991b1b' : activeSkin === 'cyber' ? '#164e63' : '#1e3a8a';
      ctx.fillStyle = helmetColor;
      ctx.beginPath();
      ctx.arc(0, -19, 7.5, Math.PI * 1.15, Math.PI * -0.15, false);
      ctx.fill();

      // Borde del casco
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -19, 7.5, Math.PI * 1.1, Math.PI * -0.1, false);
      ctx.stroke();

      // Ventilación del casco
      ctx.fillStyle = '#334155';
      for (let v = 0; v < 3; v++) {
        ctx.fillRect(-4 + v * 3.5, -25, 2, 1.5);
      }

      // Goggles (desplazadas)
      ctx.fillStyle = '#0f172a';
      let sGogX = 0;
      if (turnState === 'LEFT') sGogX = -1.5;
      if (turnState === 'RIGHT') sGogX = 1.5;

      ctx.beginPath();
      ctx.roundRect(-6 + sGogX, -21, 12, 5, 2.5);
      ctx.fill();

      // Reflejo en las goggles
      ctx.fillStyle = activeSkin === 'fire' ? '#fbbf24' : activeSkin === 'cyber' ? '#22d3ee' : '#60a5fa';
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.roundRect(-5 + sGogX, -20.5, 4.5, 3.5, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(1 + sGogX, -20.5, 4.5, 3.5, 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Marco de las goggles
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(-6 + sGogX, -21, 12, 5, 2.5);
      ctx.stroke();

      // Boca
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (turnState === 'LEFT') {
        ctx.arc(-1, -14, 2.2, 0.15 * Math.PI, 0.85 * Math.PI, false);
      } else if (turnState === 'RIGHT') {
        ctx.arc(1, -14, 2.2, 0.15 * Math.PI, 0.85 * Math.PI, false);
      } else {
        ctx.arc(0, -14, 2.5, 0.15 * Math.PI, 0.85 * Math.PI, false);
      }
      ctx.stroke();
      ctx.restore();

      // Sprite HD como overlay sutil
      if (skierImg.complete && skierImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, -4, 18, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(skierImg, -20, -24, 40, 40);
        ctx.restore();
      }
    }
  }

  // 5. EFECTO VISUAL TURBO (Cartel y fuego de neón) — Mejorado
  if (player.isTurbo) {
    // Líneas de velocidad dinámicas en los lados
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const offsetX = -14 + i * 14;
      const lineLen = 12 + Math.random() * 8;
      ctx.beginPath();
      ctx.moveTo(offsetX, -10 - Math.random() * 5);
      ctx.lineTo(offsetX, -10 + lineLen);
      ctx.stroke();
    }

    // Cartel Neón "🚀 TURBO!" con glow
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = 'rgba(0, 243, 255, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-28, -34, 56, 15, 5);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#020617';
    ctx.font = 'bold 9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀 TURBO', 0, -27);
  }

  ctx.restore();
}


// Dibuja al Yeti (Versión masiva, altamente visible y reconocible)
function drawYeti(x, y) {
  ctx.save();
  ctx.translate(x, y);

  // 0. Sombra proyectada en la nieve para dar sensación de peso y volumen
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Si está aturdido, gira en espiral y dibuja estrellas de impacto
  if (yeti.isStunned) {
    const angle = (yeti.stunTimer * 0.15) % (Math.PI * 2);
    ctx.rotate(angle);

    // Dibujar estrellas o pajaritos alrededor de la cabeza
    ctx.fillStyle = '#ffad00';
    for (let i = 0; i < 4; i++) {
      const starAngle = (Date.now() * 0.006 + i * 1.57) % (Math.PI * 2);
      const starX = Math.cos(starAngle) * 32;
      const starY = Math.sin(starAngle) * 16 - 40;
      ctx.beginPath();
      ctx.arc(starX, starY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 1. DIBUJAR SPRITE BITMAP HD DEL YETI (sin shadowColor para rendimiento móvil)
  if (yetiImg.complete && yetiImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -2, 32, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(yetiImg, -36, -38, 72, 72);
    ctx.restore();
  } else {
    // Torso masivo
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Picos de pelo salvaje (Silueta intimidante)
  ctx.fillStyle = '#ffffff';
  const furSpikes = [
    {x: -24, y: -15, r: 12}, {x: 24, y: -15, r: 12},
    {x: -26, y: 5, r: 14},  {x: 26, y: 5, r: 14},
    {x: -18, y: -26, r: 12},{x: 18, y: -26, r: 12},
    {x: 0, y: -30, r: 14},  {x: -14, y: 22, r: 12}, {x: 14, y: 22, r: 12}
  ];
  furSpikes.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. Piernas musculosas corriendo
  ctx.fillStyle = '#cbd5e1';
  const legOffset = Math.sin(yeti.animFrame * 1.2) * 10;
  
  if (yeti.isStunned || gameState === STATES.EATEN) {
    ctx.fillRect(-16, 16, 10, 16);
    ctx.fillRect(6, 16, 10, 16);
  } else {
    ctx.fillRect(-18, 14 + legOffset, 10, 18);
    ctx.fillRect(8, 14 - legOffset, 10, 18);
  }

  // 3. Brazos masivos con garras negras
  const armOffset = Math.sin(yeti.animFrame * 1.2) * 14;
  ctx.fillStyle = '#f8fafc';
  
  if (yeti.isStunned) {
    // Brazos caídos
    ctx.fillRect(-32, -6, 12, 22);
    ctx.fillRect(20, -6, 12, 22);
  } else if (gameState === STATES.EATEN) {
    // Brazos en alto festejando
    ctx.fillRect(-30, -32, 12, 28);
    ctx.fillRect(18, -32, 12, 28);
  } else {
    // Brazos extendidos alcanzando al jugador
    ctx.fillRect(-32, -14 + armOffset, 12, 30);
    ctx.fillRect(20, -14 - armOffset, 12, 30);
  }

  // Garras en las manos
  ctx.fillStyle = '#0f172a'; // Garras oscuras
  for (let c = 0; c < 3; c++) {
    const clawXLeft = -32 + c * 4;
    const clawXRight = 20 + c * 4;
    const clawYLeft = (gameState === STATES.EATEN ? -36 : -14 + armOffset + 30);
    const clawYRight = (gameState === STATES.EATEN ? -36 : -14 - armOffset + 30);
    
    ctx.fillRect(clawXLeft, clawYLeft, 2.5, 5);
    ctx.fillRect(clawXRight, clawYRight, 2.5, 5);
  }

  // 4. Máscara/Rostro del Yeti (Azul brillante)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, -8, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0284c7'; // Sombra interna
  ctx.beginPath();
  ctx.arc(0, -6, 13, 0, Math.PI * 2);
  ctx.fill();

  // 5. Ojos amenazantes
  if (yeti.isStunned) {
    // Ojos cruzados (X)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-2, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(-8, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(8, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(2, -6); ctx.stroke();
  } else {
    // Ojos rojos brillantes (glow simulado sin ctx.shadow)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(-6, -9, 7, 0, Math.PI * 2);
    ctx.arc(6, -9, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(-6, -9, 4.5, 0, Math.PI * 2);
    ctx.arc(6, -9, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Pupilas amarillas malignas
    ctx.fillStyle = '#ffad00';
    ctx.beginPath();
    ctx.arc(-6, -9, 1.8, 0, Math.PI * 2);
    ctx.arc(6, -9, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Cejas oscuras fruncidas
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-11, -15); ctx.lineTo(-2, -11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, -15); ctx.lineTo(2, -11); ctx.stroke();
  }

  // 6. Boca gigantesca con colmillos afilados
  ctx.fillStyle = '#0f172a';
  if (gameState === STATES.EATEN) {
    // Boca abierta devorando
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI, false);
    ctx.fill();
    
    // Colmillos puntiagudos superiores e inferiores
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(-3, 5); ctx.lineTo(0, 0);
    ctx.moveTo(0, 0); ctx.lineTo(3, 5); ctx.lineTo(6, 0);
    ctx.fill();
  } else {
    // Boca furiosa
    ctx.beginPath();
    ctx.arc(0, 1, 8, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.closePath();
    ctx.fill();
    
    // Colmillos puntiagudos sobresalientes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(-3, 6); ctx.lineTo(-1, 0);
    ctx.moveTo(1, 0); ctx.lineTo(3, 6); ctx.lineTo(5, 0);
    ctx.fill();
  }

  // 7. Cartel distintivo superior "YETI" para legibilidad absoluta
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-22, -48, 44, 18, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff4757';
  ctx.font = 'bold 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YETI', 0, -39);

  ctx.restore();
}

// Efecto decorativo de tormenta y ventisca de nieve en primer plano
let weatherSnowflakes = [];
const snowflakeCount = isMobile ? 12 : 36;
for (let s = 0; s < snowflakeCount; s++) {
  weatherSnowflakes.push({
    x: Math.random() * (width || 400),
    y: Math.random() * (height || 600),
    speedY: 2 + Math.random() * 2.5,
    speedX: -0.5 + Math.random() * 1.0,
    size: 1.0 + Math.random() * 2.5,
    opacity: 0.25 + Math.random() * 0.45,
    sway: Math.random() * Math.PI * 2
  });
}

function drawWeatherSnow() {
  const isBlizzard = yeti.active && gameState === STATES.PLAYING;
  const blizzardSpeedMult = isBlizzard ? 2.2 : 1.0;
  const windX = (player.speedX || 0) * 0.35;
  const snowSizeMult = isBlizzard ? 1.25 : 1.0;

  // 1. Física: mover todos los copos primero
  for (let i = 0; i < weatherSnowflakes.length; i++) {
    const sf = weatherSnowflakes[i];
    sf.sway = (sf.sway || 0) + 0.035;
    sf.y += (sf.speedY + (player.speedY || 4) * 0.15) * blizzardSpeedMult;
    sf.x += (sf.speedX + Math.sin(sf.sway) * 0.7 - windX) * blizzardSpeedMult;

    if (sf.y > height + 10) { sf.y = -10; sf.x = Math.random() * width; }
    if (sf.x < -10) { sf.x = width + 10; }
    if (sf.x > width + 10) { sf.x = -10; }
  }

  // 2. Dibujo batched: un solo path para todos los copos (evita N beginPath/fill)
  ctx.save();
  const batchAlpha = isBlizzard ? 0.65 : 0.38;
  ctx.fillStyle = `rgba(255, 255, 255, ${batchAlpha})`;
  ctx.beginPath();
  for (let i = 0; i < weatherSnowflakes.length; i++) {
    const sf = weatherSnowflakes[i];
    ctx.moveTo(sf.x + sf.size * snowSizeMult, sf.y);
    ctx.arc(sf.x, sf.y, sf.size * snowSizeMult, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

// ==========================================================================
// SISTEMA DE TEXTOS FLOTANTES (TRUCOS Y BONOS)
// ==========================================================================
function spawnFloatingText(x, y, text, color = '#fbbf24', size = 16) {
  floatingTexts.push({
    x, y, text, color, size,
    alpha: 1.0,
    vy: -2,
    life: 55
  });
}

function updateAndDrawFloatingTexts(cameraY) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life--;
    ft.alpha = ft.life / 55;

    if (ft.life <= 0) {
      floatingTexts.splice(i, 1);
      continue;
    }

    const screenY = ft.y - cameraY;
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.fillStyle = ft.color;
    // Sin ctx.shadowColor para evitar compositing layer en cada texto flotante
    ctx.font = `bold ${ft.size}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ft.text, ft.x, screenY);
    ctx.restore();
  }
}

// ==========================================================================
// RIPPLE EFFECT EN BOTONES
// ==========================================================================
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn || btn.disabled) return;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);

  ripple.addEventListener('animationend', () => ripple.remove());
});

// Inicializar traducciones de la interfaz según el idioma del dispositivo
applyTranslations();
