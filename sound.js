/**
 * Sound Manager Module
 * Sintetizador procedimental Web Audio API de alta calidad.
 * Ofrece canciones de arcade de varias frases (Chiptune arpegiado no repetitivo),
 * efectos de sonido realistas y alertas dinámicas.
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.isMusicPlaying = false;
    this.musicTimer = null;
    
    // --- 1. COMPOSICIÓN MUSICAL PRINCIPAL (SYNTHWAVE / DISCO-FUNK MODERNO) ---
    // Sección A (Funk Groove Intro): Riff pegadizo en A Mayor / F# Menor
    this.melodySectionA = [
      69, 0, 73, 76,  0, 76, 73, 69,  71, 0, 74, 78,  0, 78, 74, 71
    ];
    // Sección B (Estribillo Pop): Acordes modernos y melodía fluida
    this.melodySectionB = [
      73, 76, 81, 76,  73, 76, 81, 85,  83, 79, 76, 74,  76, 79, 83, 81
    ];
    // Sección C (Synth-Brass Lead): Melodía épica de sintetizador moderno
    this.melodySectionC = [
      81, 81, 85, 81,  78, 76, 73, 76,  81, 83, 85, 88,  85, 83, 81, 78
    ];
    // Sección D (Puente Disco-Funk): Solo rítmico con síncopa
    this.melodySectionD = [
      76, 0, 78, 81,  0, 83, 85, 88,  85, 0, 83, 81,  0, 78, 76, 73
    ];

    // Bajo Slap Funk Rítmico (Groovy Octave Slap Bass)
    this.bassSectionA = [45, 57, 45, 57, 42, 54, 42, 54, 47, 59, 47, 59, 40, 52, 40, 52];
    this.bassSectionB = [42, 54, 42, 54, 45, 57, 45, 57, 47, 59, 47, 59, 40, 52, 40, 52];
    this.bassSectionC = [45, 45, 57, 45, 42, 42, 54, 42, 47, 47, 59, 47, 40, 40, 52, 40];
    this.bassSectionD = [38, 50, 38, 50, 42, 54, 42, 54, 45, 57, 45, 57, 47, 59, 47, 59];

    // --- 2. TEMA DE BATALLA YETI (Persecución frenética) ---
    this.yetiMelody = [
      60, 61, 60, 61,  63, 64, 63, 64,  66, 67, 66, 67,  69, 70, 69, 70,
      72, 71, 70, 69,  68, 67, 66, 65,  64, 63, 62, 61,  60, 60, 63, 60
    ];
    this.yetiBass = [
      36, 36, 37, 37,  36, 36, 37, 37,  39, 39, 40, 40,  39, 39, 40, 40,
      42, 42, 43, 43,  42, 42, 43, 43,  36, 36, 37, 37,  36, 36, 36, 36
    ];

    this.isYetiActive = false;
    this.tempo = 124; // Tempo Disco/Funk bailable y moderno
    this.stepIndex = 0;
    this.speedMultiplier = 1.0;
  }

  init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.error("[Sound] Error inicializando AudioContext:", e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    console.log(`[Sound] Mute: ${this.muted}`);
    if (this.muted) {
      this.stopMusic();
    } else {
      if (window.gameState === 'PLAYING' || window.gameState === 'JUMPING') {
        this.startMusic();
      }
    }
    return this.muted;
  }

  playYetiTheme() {
    this.isYetiActive = true;
    this.stepIndex = 0; // Reiniciar frase para impacto inmediato
  }

  playNormalTheme() {
    this.isYetiActive = false;
  }

  // --- EFECTOS DE SONIDO RETRO (SFX) ---

  playJump() {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.16);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // Sonido de Super-Turbo al aterrizar de rampa
  playTurbo() {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
    
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.31);
  }

  // Sonido de Moneda Recogida
  playCoin() {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987, now); // Nota B5
    osc.frequency.setValueAtTime(1318, now + 0.08); // Nota E6 (Arpeggio brillante)
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.21);
  }

  // Sonido de Recompensa / Truco Especial
  playReward() {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Arpeggio brillante)
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      
      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.22);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.23);
    });
  }

  // Sonido de Power-Up Activado
  playPowerUp() {
    try {
      this.init();
      if (this.muted || !this.ctx) return;
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.29);
    } catch (e) {
      console.warn('[Sound] playPowerUp error bypassed:', e);
    }
  }

  playCrash(obstacleType) {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    
    if (obstacleType === 'TREE') {
      // Choque contra Árbol: Golpe de madera sordo y bajo
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(25, now + 0.28);
      
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);

    } else if (obstacleType === 'ROCK') {
      // Choque contra Roca: Impacto duro metálico y resonante
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(520, now);
      osc1.frequency.exponentialRampToValueAtTime(90, now + 0.24);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(528, now);
      osc2.frequency.exponentialRampToValueAtTime(90, now + 0.24);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.27);
      osc2.stop(now + 0.27);

    } else {
      // Choque general
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(30, now + 0.35);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  // Grito retro "AAAAA!" al ser atrapado por el Yeti
  playScream() {
    if (this.muted || !this.ctx) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(170, now + 0.75);

    // Modulación de vibrato trémolo
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(15, now);
    lfoGain.gain.setValueAtTime(95, now);
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.76);
    osc.stop(now + 0.76);
  }

  playEat() {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const timeOffset = i * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130 - (i * 22), now + timeOffset);
      
      gain.gain.setValueAtTime(0.22, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + timeOffset + 0.1);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.11);
    }
  }

  playYetiWarning() {
    if (this.muted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(680, now + 0.18);
    osc.frequency.linearRampToValueAtTime(440, now + 0.36);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.36);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.37);
  }

  // --- MÚSICA DE FONDO MULTI-FRASE DINÁMICA ---

  playNormalTheme() {
    this.isYetiActive = false;
  }

  playYetiTheme() {
    this.isYetiActive = true;
  }

  startMusic() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.isMusicPlaying = true;
    if (!this.musicTimer) {
      this.stepIndex = 0;
      this.playNextMusicStep();
    }
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.8, Math.min(1.8, multiplier));
  }

  midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  playNextMusicStep() {
    if (!this.isMusicPlaying || this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const effectiveTempo = this.isYetiActive ? this.tempo * 1.25 : this.tempo;
    const stepDuration = (60 / effectiveTempo) / 2 / this.speedMultiplier; // Corcheas (1/8 notes)

    let currentMelody, currentBass;

    if (this.isYetiActive) {
      currentMelody = this.yetiMelody;
      currentBass = this.yetiBass;
    } else {
      // Rotar entre las 4 secciones musicales (Verso, Pre-Coro, Coro, Solo) cada 16 pasos
      const movementIndex = Math.floor((this.stepIndex % 64) / 16);
      if (movementIndex === 0) {
        currentMelody = this.melodySectionA;
        currentBass = this.bassSectionA;
      } else if (movementIndex === 1) {
        currentMelody = this.melodySectionB;
        currentBass = this.bassSectionB;
      } else if (movementIndex === 2) {
        currentMelody = this.melodySectionC;
        currentBass = this.bassSectionC;
      } else {
        currentMelody = this.melodySectionD;
        currentBass = this.bassSectionD;
      }
    }

    const stepInPhrase = this.stepIndex % currentMelody.length;

    // --- 1. CANAL SINTETIZADOR LEAD MODERNO (Sawtooth Brass con Filtro Pasabajos) ---
    const note = currentMelody[stepInPhrase];
    if (note > 0) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      // Filtro cálido de sintetizador moderno (Lowpass 1600Hz)
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2.5, now);

      const vol = this.isYetiActive ? 0.035 : 0.045;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + stepDuration * 0.9);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + stepDuration * 0.92);
    }

    // --- 2. CANAL BASSLINE SLAP-FUNK (Bajo Funk de Slap) ---
    const bassNote = currentBass[stepInPhrase];
    if (bassNote > 0) {
      const oscBass = this.ctx.createOscillator();
      const filterBass = this.ctx.createBiquadFilter();
      const gainBass = this.ctx.createGain();
      
      oscBass.type = 'sawtooth';
      oscBass.frequency.setValueAtTime(this.midiToFreq(bassNote), now);
      
      filterBass.type = 'lowpass';
      filterBass.frequency.setValueAtTime(800, now);
      filterBass.frequency.exponentialRampToValueAtTime(180, now + stepDuration * 0.8);
      
      gainBass.gain.setValueAtTime(0.07, now);
      gainBass.gain.exponentialRampToValueAtTime(0.002, now + stepDuration * 0.85);
      
      oscBass.connect(filterBass);
      filterBass.connect(gainBass);
      gainBass.connect(this.ctx.destination);
      
      oscBass.start(now);
      oscBass.stop(now + stepDuration * 0.88);
    }

    // --- 3. BATERÍA / RITMO RETRO (Kick + Snare/Hi-Hat + Platillos) ---
    const beatIndex = stepInPhrase % 4;

    // Platillo Crash al inicio de cada movimiento (Paso 0)
    if (stepInPhrase === 0) {
      const oscCrash = this.ctx.createOscillator();
      const gainCrash = this.ctx.createGain();
      oscCrash.type = 'triangle';
      oscCrash.frequency.setValueAtTime(6000, now);
      gainCrash.gain.setValueAtTime(0.035, now);
      gainCrash.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      oscCrash.connect(gainCrash);
      gainCrash.connect(this.ctx.destination);
      oscCrash.start(now);
      oscCrash.stop(now + 0.16);
    }
    
    // Kick (Bordo Disco-Funk 4-on-the-floor) en CADA tiempo
    if (beatIndex === 0 || beatIndex === 1 || beatIndex === 2 || beatIndex === 3) {
      const oscKick = this.ctx.createOscillator();
      const gainKick = this.ctx.createGain();
      oscKick.type = 'sine';
      oscKick.frequency.setValueAtTime(140, now);
      oscKick.frequency.exponentialRampToValueAtTime(38, now + 0.09);
      
      gainKick.gain.setValueAtTime(0.12, now);
      gainKick.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      
      oscKick.connect(gainKick);
      gainKick.connect(this.ctx.destination);
      oscKick.start(now);
      oscKick.stop(now + 0.1);
    }

    // Hi-Hat brillante en contratiempos (Groove Disco)
    if (beatIndex === 1 || beatIndex === 3) {
      const oscHat = this.ctx.createOscillator();
      const gainHat = this.ctx.createGain();
      oscHat.type = 'triangle';
      oscHat.frequency.setValueAtTime(7500, now);
      
      gainHat.gain.setValueAtTime(0.035, now);
      gainHat.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      oscHat.connect(gainHat);
      gainHat.connect(this.ctx.destination);
      oscHat.start(now);
      oscHat.stop(now + 0.06);
    }

    // Avanzar paso
    this.stepIndex++;
    
    // Agendar siguiente paso
    this.musicTimer = setTimeout(() => {
      this.playNextMusicStep();
    }, stepDuration * 1000);
  }
}

export const sound = new SoundManager();
window.SoundManager = sound; // Acceso global para debug y consola
