import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Trophy, HelpCircle, Coins, Zap, Shield, Magnet, Rocket,
  Pause, Volume2, VolumeX, RotateCcw, Home, Crown, ChevronLeft,
  ChevronRight, ChevronUp, ChevronDown, Flame, Gauge, X, Sparkles, Timer, Medal,
  Download, Maximize, Minimize, WifiOff, Smartphone, Vibrate, VibrateOff,
  Package, Check, Share
} from 'lucide-react';
import { DreamEngine, type HudState, type GameStats, type PowerKind } from './game/engine';
import { sound } from './game/audio';
import {
  isAndroid, isMobile, isStandalone, isNative, getPerfTier, haptics,
  setHapticsEnabled, getHapticsEnabled,
  enterFullscreen, exitFullscreen, lockPortrait,
  acquireWakeLock, releaseWakeLock,
  onInstallChange, promptInstall, initNativeApp, type PerfTier,
} from './game/android';

type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover';

const initialHud: HudState = {
  score: 0, coins: 0, distance: 0, speed: 0,
  dreamPower: 0, dreamReady: false, dreamMode: false,
  shield: false, magnet: 0, rocket: 0, x2: 0,
  athBoost: 0, athCount: 0,
};

function fmt(n: number) { return n.toLocaleString('en-US'); }

const FAKE_BOARD = [
  { name: 'DREAM_WHALE', s: 48250, c: 312 },
  { name: 'MOON_RIDER', s: 36400, c: 240 },
  { name: 'GOLD_HANDS', s: 28120, c: 198 },
  { name: 'CEO_BULL', s: 21040, c: 150 },
  { name: 'HODL_KING', s: 15600, c: 112 },
  { name: 'NEON_TRADER', s: 9800, c: 74 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DreamEngine | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudState>(initialHud);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem('dreamrun_best') || 0));
  const [showHow, setShowHow] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showApk, setShowApk] = useState(false);
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [dreamFlash, setDreamFlash] = useState(false);
  const [goToast, setGoToast] = useState(false);
  const [powerToast, setPowerToast] = useState<{ kind: PowerKind; id: number } | null>(null);
  const [athToast, setAthToast] = useState<{ id: number; count: number } | null>(null);
  // ---- Android state ----
  const [android] = useState(() => isAndroid());
  const [mobile] = useState(() => isMobile());
  const [standalone, setStandalone] = useState(() => isStandalone());
  const [canInstall, setCanInstall] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [hapticsOn, setHapticsOn] = useState(() => getHapticsEnabled());
  const [quality, setQuality] = useState<PerfTier>(() => {
    try {
      const saved = localStorage.getItem('dreamrun_quality') as PerfTier | null;
      if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
    } catch { /* ignore */ }
    return getPerfTier();
  });
  const phaseRef = useRef<Phase>('menu');
  phaseRef.current = phase;
  const modalRef = useRef({ showHow, showBoard, showApk });
  modalRef.current = { showHow, showBoard, showApk };

  /* ---------- engine lifecycle ---------- */
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new DreamEngine(canvasRef.current, {
      onHUD: (h) => setHud(h),
      onGameOver: (s) => {
        setStats(s);
        setBest(s.best);
        setPhase('gameover');
        void releaseWakeLock();
      },
      onDreamReady: () => {
        haptics.dreamReady();
        setDreamFlash(true);
        setTimeout(() => setDreamFlash(false), 2500);
      },
      onCoin: () => { haptics.coin(); },
      onPowerup: (k) => {
        setPowerToast({ kind: k, id: Date.now() });
        setTimeout(() => setPowerToast(null), 1800);
      },
      onATH: () => {
        setAthToast({ id: Date.now(), count: 0 });
        setTimeout(() => setAthToast(null), 2600);
      },
    });
    engine.init();
    // apply saved quality
    try {
      const saved = localStorage.getItem('dreamrun_quality') as PerfTier | null;
      if (saved === 'low' || saved === 'medium' || saved === 'high') engine.setQuality(saved);
    } catch { /* ignore */ }
    engine.toIdle();
    engineRef.current = engine;
    setBest(Number(localStorage.getItem('dreamrun_best') || 0));
    setStandalone(isStandalone());
    // PWA shortcut: ?play=1 auto-starts a run
    try {
      if (new URLSearchParams(window.location.search).get('play') === '1') {
        setTimeout(() => {
          if (phaseRef.current === 'menu') startGameRef.current();
        }, 900);
      }
    } catch { /* ignore */ }
    return () => { engine.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = useCallback(() => {
    sound.click();
    haptics.tap();
    // Android: go immersive + keep screen awake while running
    if (isMobile()) {
      void enterFullscreen().then(() => lockPortrait());
      void acquireWakeLock();
    }
    setStats(null);
    setHud(initialHud);
    setPhase('countdown');
    setCountdown(3);
    sound.countdown();
    let c = 3;
    const iv = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(iv);
        engineRef.current?.start();
        setPhase('playing');
        sound.go();
        haptics.powerup();
        setGoToast(true);
        setTimeout(() => setGoToast(false), 1200);
      } else {
        setCountdown(c);
        sound.countdown();
      }
    }, 700);
  }, []);
  const startGameRef = useRef(startGame);
  startGameRef.current = startGame;

  const goMenu = useCallback(() => {
    sound.click();
    haptics.tap();
    void releaseWakeLock();
    engineRef.current?.toIdle();
    setPhase('menu');
    setStats(null);
    setHud(initialHud);
  }, []);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      engineRef.current?.pause();
      setPhase('paused');
      sound.click();
      void releaseWakeLock();
    } else if (phaseRef.current === 'paused') {
      engineRef.current?.resume();
      setPhase('playing');
      sound.click();
      if (isMobile()) void acquireWakeLock();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      sound.setMuted(!m);
      return !m;
    });
  }, []);

  const toggleHaptics = useCallback(() => {
    setHapticsOn((v) => {
      const nv = !v;
      setHapticsEnabled(nv);
      if (nv) haptics.tap();
      return nv;
    });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    haptics.tap();
    if (document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
      lockPortrait();
    }
  }, []);

  const changeQuality = useCallback((q: PerfTier) => {
    setQuality(q);
    try { localStorage.setItem('dreamrun_quality', q); } catch { /* ignore */ }
    engineRef.current?.setQuality(q);
    sound.click();
    haptics.tap();
  }, []);

  const handleInstall = useCallback(async () => {
    haptics.tap();
    sound.click();
    const res = await promptInstall();
    if (res === 'accepted') setStandalone(true);
    else if (res === 'unavailable') setShowApk(true);
  }, []);

  /* ---------- install / fullscreen / online listeners ---------- */
  useEffect(() => onInstallChange(setCanInstall), []);
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* ---------- Android back-button: close modals / pause instead of exiting ---------- */
  useEffect(() => {
    // Shared handler used by both web (popstate) and native APK (Capacitor App plugin)
    const handleBack = (): boolean => {
      const m = modalRef.current;
      if (m.showHow || m.showBoard || m.showApk) {
        setShowHow(false); setShowBoard(false); setShowApk(false);
        return true;
      }
      if (phaseRef.current === 'playing') {
        togglePause();
        return true;
      }
      if (phaseRef.current === 'paused' || phaseRef.current === 'gameover') {
        goMenu();
        return true;
      }
      return false; // menu -> allow exit on native
    };
    // Native APK: hardware back button + pause/resume lifecycle
    void initNativeApp({
      onBackButton: handleBack,
      onPause: () => { if (phaseRef.current === 'playing') togglePause(); },
      onResume: () => { if (isNative() && phaseRef.current === 'playing') void acquireWakeLock(); },
    });
    // Web fallback: history trap
    if (!isNative()) {
      try { window.history.pushState({ dream: true }, ''); } catch { /* ignore */ }
      const onPop = () => {
        handleBack();
        try { window.history.pushState({ dream: true }, ''); } catch { /* ignore */ }
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }
  }, [togglePause, goMenu]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ph = phaseRef.current;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      if (ph === 'playing') {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') engineRef.current?.moveLeft();
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') engineRef.current?.moveRight();
        else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') engineRef.current?.jump();
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') engineRef.current?.slide();
        else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') engineRef.current?.activateDream();
        else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
        else if (e.key === 'm' || e.key === 'M') toggleMute();
      } else if (ph === 'paused' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
        togglePause();
      } else if (ph === 'menu' && e.key === 'Enter') {
        startGame();
      } else if (ph === 'gameover' && (e.key === 'Enter' || e.key === ' ')) {
        startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startGame, togglePause, toggleMute]);

  /* ---------- touch: INSTANT swipe on move (Subway-Surfers feel) ---------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let sx = 0, sy = 0, st = 0, moved = false;
    const THRESH = 26;
    const inBtn = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      return !!(t && t.closest && t.closest('button'));
    };
    const onStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; st = Date.now(); moved = false;
    };
    const onMove = (e: TouchEvent) => {
      if (phaseRef.current === 'playing') e.preventDefault();
      if (phaseRef.current !== 'playing' || inBtn(e)) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESH) return;
      moved = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) engineRef.current?.moveRight();
        else engineRef.current?.moveLeft();
      } else {
        if (dy < 0) engineRef.current?.jump();
        else engineRef.current?.slide();
      }
      // reset origin so one continuous gesture can chain multiple swipes
      sx = t.clientX; sy = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (phaseRef.current !== 'playing' || inBtn(e)) return;
      if (moved) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const dt = Date.now() - st;
      // quick tap = jump
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22 && dt < 280) {
        engineRef.current?.jump();
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  /* auto-pause when tab hidden / app backgrounded */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === 'playing') togglePause();
      // re-acquire wake lock when back
      if (!document.hidden && phaseRef.current === 'playing' && isMobile()) void acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', () => {
      if (phaseRef.current === 'playing') togglePause();
    });
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [togglePause]);

  const boardEntries = useCallback(() => {
    let mine: Array<{ s: number; c: number; d: string }> = [];
    try { mine = JSON.parse(localStorage.getItem('dreamrun_runs') || '[]'); } catch { mine = []; }
    const all = [
      ...FAKE_BOARD.map((f) => ({ name: f.name, s: f.s, c: f.c, you: false })),
      ...mine.map((m) => ({ name: m.s === best && best > 0 ? 'YOU ★' : 'YOU', s: m.s, c: m.c, you: true })),
    ].sort((a, b) => b.s - a.s).slice(0, 10);
    return all;
  }, [best]);

  const inGame = phase === 'playing' || phase === 'paused' || phase === 'countdown';

  const press = (fn: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => { e.stopPropagation(); e.preventDefault(); fn(); },
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); fn(); },
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-[#05060f] text-white select-none overscroll-none"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        height: 'var(--app-height, 100dvh)',
        touchAction: 'none',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full block" />

      {/* cinematic vignette */}
      <div className="pointer-events-none absolute inset-0 vignette" />
      {/* dream mode golden overlay */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-500 dream-vignette ${hud.dreamMode && phase === 'playing' ? 'opacity-100' : 'opacity-0'}`} />
      {/* top gradient for HUD readability */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />

      {/* offline ribbon */}
      {!online && (
        <div className="absolute top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/90 text-black text-[11px] font-black tracking-widest py-1">
          <WifiOff className="h-3.5 w-3.5" /> OFFLINE MODE — SCORES SAVED LOCALLY
        </div>
      )}

      {/* ================= HUD ================= */}
      {inGame && (
        <div className="absolute inset-x-0 top-0 z-20 px-2 sm:px-4 safe-top">
          <div className="flex items-start justify-between gap-2">
            {/* SCORE */}
            <div className="hud-box min-w-[92px] sm:min-w-[140px]">
              <div className="hud-label"><Zap className="h-3 w-3 text-amber-300" /> SCORE</div>
              <div className="hud-value gold-text">{fmt(hud.score)}</div>
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
                <Gauge className="h-3 w-3" /> {hud.speed} km/h · {fmt(hud.distance)}m
              </div>
            </div>
            {/* DREAM POWER */}
            <div className="flex-1 max-w-[300px] sm:max-w-[380px]">
              <button
                onClick={() => engineRef.current?.activateDream()}
                className={`w-full hud-box text-center transition-all ${hud.dreamMode ? 'dream-active' : hud.dreamReady ? 'dream-ready animate-pulse' : ''}`}
              >
                <div className="hud-label justify-center">
                  <Crown className="h-3 w-3 text-amber-300" />
                  <span className={hud.dreamMode ? 'text-amber-200' : ''}>{hud.dreamMode ? 'DREAM MODE' : 'DREAM POWER'}</span>
                </div>
                <div className="mt-1 h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-black/70 border border-amber-500/30">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${hud.dreamMode ? 'bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 dream-bar' : 'bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300'}`}
                    style={{ width: `${hud.dreamMode ? 100 : Math.min(100, hud.dreamPower)}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[9px] sm:text-[10px] font-bold tracking-widest text-amber-200/90">
                  {hud.dreamMode ? '✦ INVINCIBLE ✦' : hud.dreamReady ? 'TAP TO ACTIVATE ✦' : `${Math.floor(hud.dreamPower)}%`}
                </div>
              </button>
              {/* active powerups */}
              <div className="mt-1.5 flex justify-center gap-1.5 flex-wrap">
                {hud.athBoost > 0 && <div className="power-chip border-amber-300 text-amber-200 ath-chip"><Crown className="h-3.5 w-3.5" />ATH {Math.ceil(hud.athBoost)}s</div>}
                {hud.shield && <div className="power-chip border-sky-400/60 text-sky-300"><Shield className="h-3.5 w-3.5" /><span className="hidden sm:inline">SHIELD</span></div>}
                {hud.magnet > 0 && <div className="power-chip border-fuchsia-400/60 text-fuchsia-300"><Magnet className="h-3.5 w-3.5" />{Math.ceil(hud.magnet)}s</div>}
                {hud.rocket > 0 && <div className="power-chip border-orange-400/60 text-orange-300"><Rocket className="h-3.5 w-3.5" />{Math.ceil(hud.rocket)}s</div>}
                {hud.x2 > 0 && <div className="power-chip border-emerald-400/60 text-emerald-300"><Coins className="h-3.5 w-3.5" />X2 {Math.ceil(hud.x2)}s</div>}
              </div>
            </div>
            {/* COINS */}
            <div className="hud-box min-w-[92px] sm:min-w-[140px] text-right">
              <div className="hud-label justify-end"><Coins className="h-3 w-3 text-amber-300" /> COINS</div>
              <div className="hud-value gold-text">{fmt(hud.coins)}</div>
              <div className="flex justify-end gap-1 mt-0.5">
                <button onClick={toggleMute} className="icon-btn" aria-label="mute">
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                {mobile && (
                  <button onClick={toggleFullscreen} className="icon-btn" aria-label="fullscreen">
                    {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button onClick={togglePause} className="icon-btn" aria-label="pause">
                  {phase === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* powerup toast */}
      {powerToast && phase === 'playing' && (
        <div key={powerToast.id} className="absolute top-[24%] left-1/2 z-30 -translate-x-1/2 toast-pop">
          <div className="flex items-center gap-2 rounded-2xl border border-amber-400/60 bg-black/80 px-5 py-2.5 shadow-[0_0_40px_rgba(255,200,60,0.45)]">
            {powerToast.kind === 'rocket' && <><Rocket className="h-5 w-5 text-orange-400" /><span className="font-black tracking-widest text-orange-300">GOLDEN ROCKET!</span></>}
            {powerToast.kind === 'shield' && <><Shield className="h-5 w-5 text-sky-400" /><span className="font-black tracking-widest text-sky-300">DREAM SHIELD!</span></>}
            {powerToast.kind === 'magnet' && <><Magnet className="h-5 w-5 text-fuchsia-400" /><span className="font-black tracking-widest text-fuchsia-300">COIN MAGNET!</span></>}
            {powerToast.kind === 'x2' && <><Coins className="h-5 w-5 text-emerald-400" /><span className="font-black tracking-widest text-emerald-300">X2 COINS!</span></>}
          </div>
        </div>
      )}

      {/* dream ready banner */}
      {dreamFlash && phase === 'playing' && !hud.dreamMode && (
        <div className="absolute top-[32%] left-1/2 z-30 -translate-x-1/2 toast-pop">
          <button onClick={() => engineRef.current?.activateDream()} className="dream-cta">
            <Crown className="h-6 w-6" /> ACTIVATE DREAM MODE <Sparkles className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* dream mode banner */}
      {hud.dreamMode && phase === 'playing' && (
        <div className="absolute top-[17%] left-1/2 z-20 -translate-x-1/2 pointer-events-none">
          <div className="dream-banner">✦ DREAM MODE ✦</div>
        </div>
      )}

      {/* ALL TIME HIGH cinematic banner */}
      {athToast && phase === 'playing' && (
        <div key={athToast.id} className="absolute inset-x-0 top-[21%] z-30 flex justify-center pointer-events-none px-4">
          <div className="ath-banner">
            <div className="flex items-center justify-center gap-2 text-[11px] font-black tracking-[0.4em] text-amber-200">
              <Crown className="h-4 w-4" /> BREAKOUT <Crown className="h-4 w-4" />
            </div>
            <div className="ath-title gold-text">ALL TIME HIGH</div>
            <div className="mt-1 text-center text-sm font-black tracking-[0.3em] text-emerald-300">▲ +300% · SPEED SURGE ▲</div>
            <div className="mt-0.5 text-center text-[10px] font-bold tracking-widest text-amber-200/80">+250 SCORE · DREAM POWER +22</div>
          </div>
        </div>
      )}
      {/* ATH boost edge glow */}
      {hud.athBoost > 0 && phase === 'playing' && <div className="pointer-events-none absolute inset-0 z-10 ath-vignette" />}

      {/* GO toast */}
      {goToast && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="go-text">GO!</div>
        </div>
      )}

      {/* mobile controls */}
      {phase === 'playing' && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 safe-bottom">
          <div className="flex items-end justify-between">
            <div className="flex gap-2.5">
              <button className="ctl-btn" {...press(() => engineRef.current?.moveLeft())} aria-label="left"><ChevronLeft className="h-8 w-8" /></button>
              <button className="ctl-btn" {...press(() => engineRef.current?.moveRight())} aria-label="right"><ChevronRight className="h-8 w-8" /></button>
            </div>
            <div className="hidden sm:block text-center text-[11px] tracking-widest text-slate-500 font-bold">
              A/D MOVE · W JUMP · S SLIDE · E DREAM
            </div>
            <div className="flex gap-2.5">
              <button className="ctl-btn ctl-gold" {...press(() => engineRef.current?.slide())} aria-label="slide"><ChevronDown className="h-8 w-8" /></button>
              <button className="ctl-btn ctl-gold" {...press(() => engineRef.current?.jump())} aria-label="jump"><ChevronUp className="h-8 w-8" /></button>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] tracking-[0.25em] text-slate-500 font-bold sm:hidden">SWIPE TO MOVE · TAP TO JUMP</div>
        </div>
      )}

      {/* ================= COUNTDOWN ================= */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 text-amber-300 tracking-[0.4em] text-xs font-black"><Crown className="h-4 w-4" /> GET READY</div>
          <div key={countdown} className="count-num gold-text">{countdown}</div>
          <div className="text-slate-400 text-sm font-bold tracking-widest">{mobile ? 'SWIPE TO MOVE · TAP TO JUMP' : 'SWIPE OR USE ARROW KEYS'}</div>
        </div>
      )}

      {/* ================= PAUSED ================= */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="menu-panel max-w-sm w-full text-center" data-scroll>
            <div className="text-3xl font-black tracking-widest gold-text">PAUSED</div>
            <div className="mt-1 text-slate-400 text-sm font-bold">SCORE {fmt(hud.score)} · {fmt(hud.coins)} COINS</div>
            {/* Android quick settings */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={toggleMute} className={`mini-toggle ${!muted ? 'on' : ''}`}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span>SOUND</span>
              </button>
              <button onClick={toggleHaptics} className={`mini-toggle ${hapticsOn ? 'on' : ''}`}>
                {hapticsOn ? <Vibrate className="h-4 w-4" /> : <VibrateOff className="h-4 w-4" />}
                <span>BUZZ</span>
              </button>
              <button onClick={toggleFullscreen} className={`mini-toggle ${isFullscreen ? 'on' : ''}`}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                <span>FULL</span>
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-500">QUALITY</span>
              {(['low', 'medium', 'high'] as PerfTier[]).map((q) => (
                <button key={q} onClick={() => changeQuality(q)} className={`q-btn ${quality === q ? 'q-on' : ''}`}>{q.toUpperCase()}</button>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <button onClick={togglePause} className="btn-gold w-full"><Play className="h-5 w-5" /> RESUME RUN</button>
              <button onClick={startGame} className="btn-ghost w-full"><RotateCcw className="h-5 w-5" /> RESTART</button>
              <button onClick={goMenu} className="btn-ghost w-full"><Home className="h-5 w-5" /> MAIN MENU</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN MENU ================= */}
      {phase === 'menu' && (
        <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto" data-scroll>
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-0 safe-top">
            {/* logo */}
            <div className="text-center float-slow">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-black/60 px-4 py-1 text-[10px] sm:text-xs font-black tracking-[0.35em] text-amber-300 shadow-[0_0_30px_rgba(255,190,40,0.35)]">
                <Flame className="h-3.5 w-3.5" /> $DREAM · LUXURY CRYPTO CITY <Flame className="h-3.5 w-3.5" />
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <Crown className="h-8 w-8 sm:h-12 sm:w-12 text-amber-400 drop-shadow-[0_0_18px_rgba(255,190,40,0.9)] crown-bounce" />
              </div>
              <h1 className="title-gold text-5xl sm:text-7xl md:text-8xl">DREAM RUN</h1>
              <p className="mt-2 text-slate-300 text-xs sm:text-sm font-bold tracking-[0.3em]">ENDLESS CEO RUNNER</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                {standalone
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/50 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-300"><Check className="h-3 w-3" /> INSTALLED · OFFLINE READY</span>
                  : android
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/15 px-3 py-1 text-[10px] font-black tracking-widest text-slate-300"><Smartphone className="h-3 w-3" /> ANDROID EDITION</span>
                    : null}
              </div>
            </div>

            {/* best */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-black/60 px-5 py-2 backdrop-blur-sm">
              <Trophy className="h-5 w-5 text-amber-400" />
              <div className="text-left">
                <div className="text-[10px] font-black tracking-[0.3em] text-slate-400">BEST SCORE</div>
                <div className="text-xl font-black gold-text leading-none">{fmt(best)}</div>
              </div>
              <div className="h-8 w-px bg-amber-500/20" />
              <button onClick={toggleMute} className="icon-btn" aria-label="mute">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              {mobile && (
                <button onClick={toggleHaptics} className="icon-btn" aria-label="haptics">
                  {hapticsOn ? <Vibrate className="h-4 w-4" /> : <VibrateOff className="h-4 w-4" />}
                </button>
              )}
            </div>

            {/* buttons */}
            <div className="mt-6 w-full max-w-xs space-y-3">
              <button onClick={startGame} className="btn-gold w-full text-lg"><Play className="h-6 w-6" /> START RUN</button>
              {(canInstall || (android && !standalone)) && (
                <button onClick={handleInstall} className="btn-install w-full">
                  <Download className="h-5 w-5" /> {canInstall ? 'INSTALL APP' : 'GET ANDROID APP'}
                </button>
              )}
              <div className="grid grid-cols-3 gap-2.5">
                <button onClick={() => { sound.click(); setShowBoard(true); }} className="btn-ghost !px-2"><Trophy className="h-5 w-5" /> RANKS</button>
                <button onClick={() => { sound.click(); setShowHow(true); }} className="btn-ghost !px-2"><HelpCircle className="h-5 w-5" /> HOW TO</button>
                <button onClick={() => { sound.click(); setShowApk(true); }} className="btn-ghost !px-2"><Package className="h-5 w-5" /> APK</button>
              </div>
            </div>

            {/* powerup strip */}
            <div className="mt-6 hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-300 flex-wrap justify-center">
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/60 px-3 py-1.5 text-amber-200"><Crown className="h-3.5 w-3.5" /> ALL TIME HIGH</span>
              <span className="flex items-center gap-1 rounded-full bg-black/60 border border-orange-500/40 px-3 py-1.5"><Rocket className="h-3.5 w-3.5 text-orange-400" /> ROCKET</span>
              <span className="flex items-center gap-1 rounded-full bg-black/60 border border-sky-500/40 px-3 py-1.5"><Shield className="h-3.5 w-3.5 text-sky-400" /> SHIELD</span>
              <span className="flex items-center gap-1 rounded-full bg-black/60 border border-fuchsia-500/40 px-3 py-1.5"><Magnet className="h-3.5 w-3.5 text-fuchsia-400" /> MAGNET</span>
              <span className="flex items-center gap-1 rounded-full bg-black/60 border border-emerald-500/40 px-3 py-1.5"><Coins className="h-3.5 w-3.5 text-emerald-400" /> X2</span>
            </div>
          </div>
          {/* ticker */}
          <div className="shrink-0 border-t border-amber-500/20 bg-black/70 py-2 overflow-hidden safe-bottom-pad">
            <div className="ticker flex gap-8 whitespace-nowrap text-[11px] font-black tracking-widest text-amber-300/90">
              {[0, 1].map((k) => (
                <span key={k} className="flex gap-8">
                  <span>$DREAM +128.4% ▲</span><span>BTC $97,240 ▲</span><span>MARKET CAP $1.9B</span>
                  <span>HODL SEASON</span><span>DREAM POWER 100%</span><span>TO THE MOON 🚀</span>
                  <span>$DREAM +128.4% ▲</span><span>BTC $97,240 ▲</span><span>MARKET CAP $1.9B</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= GAME OVER ================= */}
      {phase === 'gameover' && stats && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[3px] p-4 overflow-y-auto" data-scroll>
          <div className="menu-panel w-full max-w-md text-center gameover-pop">
            {stats.isNewBest && (
              <div className="mx-auto -mt-2 mb-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 px-4 py-1 text-xs font-black tracking-widest text-black shadow-[0_0_30px_rgba(255,200,60,0.7)] animate-pulse">
                <Sparkles className="h-3.5 w-3.5" /> NEW BEST! <Sparkles className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex justify-center"><Crown className="h-10 w-10 text-amber-400 drop-shadow-[0_0_16px_rgba(255,190,40,0.9)]" /></div>
            <h2 className="title-gold text-4xl sm:text-5xl mt-1">DREAM RUN<br />OVER</h2>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="stat-card">
                <Zap className="mx-auto h-4 w-4 text-amber-300" />
                <div className="stat-val">{fmt(stats.score)}</div>
                <div className="stat-label">SCORE</div>
              </div>
              <div className="stat-card">
                <Coins className="mx-auto h-4 w-4 text-amber-300" />
                <div className="stat-val">{fmt(stats.coins)}</div>
                <div className="stat-label">COINS</div>
              </div>
              <div className="stat-card">
                <Timer className="mx-auto h-4 w-4 text-amber-300" />
                <div className="stat-val">{fmt(stats.distance)}m</div>
                <div className="stat-label">DISTANCE</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-slate-300">
              <Trophy className="h-4 w-4 text-amber-400" /> BEST: <span className="gold-text font-black">{fmt(stats.best)}</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/10 px-4 py-1 text-xs font-black tracking-widest text-amber-200">
              <Crown className="h-3.5 w-3.5" /> {stats.athCount}× ALL TIME HIGH
            </div>
            <div className="mt-5 space-y-3">
              <button onClick={startGame} className="btn-gold w-full text-lg"><RotateCcw className="h-6 w-6" /> RUN AGAIN</button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { sound.click(); setShowBoard(true); }} className="btn-ghost"><Trophy className="h-5 w-5" /> RANKS</button>
                <button onClick={goMenu} className="btn-ghost"><Home className="h-5 w-5" /> MENU</button>
              </div>
              {(canInstall || (android && !standalone)) && (
                <button onClick={handleInstall} className="btn-install w-full !py-2.5 text-sm"><Download className="h-4 w-4" /> INSTALL APP — PLAY OFFLINE</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= HOW TO PLAY ================= */}
      {showHow && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" data-scroll>
          <div className="menu-panel w-full max-w-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black tracking-widest gold-text">HOW TO PLAY</h3>
              <button onClick={() => { sound.click(); setShowHow(false); }} className="icon-btn"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="how-card"><div className="flex gap-1 justify-center"><span className="key"><ChevronLeft className="h-4 w-4" /></span><span className="key"><ChevronRight className="h-4 w-4" /></span></div><div className="mt-2 font-bold">SWITCH LANE</div><div className="text-xs text-slate-400">Swipe ◀ ▶ or A / D</div></div>
              <div className="how-card"><div className="flex gap-1 justify-center"><span className="key"><ChevronUp className="h-4 w-4" /></span></div><div className="mt-2 font-bold">JUMP</div><div className="text-xs text-slate-400">Swipe ▲, W or tap</div></div>
              <div className="how-card"><div className="flex gap-1 justify-center"><span className="key"><ChevronDown className="h-4 w-4" /></span></div><div className="mt-2 font-bold">SLIDE</div><div className="text-xs text-slate-400">Swipe ▼ or S — dodge lasers</div></div>
              <div className="how-card"><div className="flex gap-1 justify-center"><span className="key"><Crown className="h-4 w-4 text-amber-400" /></span></div><div className="mt-2 font-bold text-amber-300">DREAM MODE</div><div className="text-xs text-slate-400">Fill meter, press E / tap</div></div>
            </div>
            {mobile && (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200 text-left">
                <b>📱 ANDROID TIPS:</b> swipes register instantly — you can chain them in one motion. Use the on-screen buttons if you prefer. Install the app for fullscreen + offline play.
              </div>
            )}
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-400/50 p-2.5"><Crown className="h-5 w-5 text-amber-300 shrink-0" /><div className="text-left"><b className="text-amber-200">ALL TIME HIGH GATE</b><div className="text-xs text-slate-400">Run through the golden gate: +300% explosion, speed surge + Dream Power</div></div></div>
              <div className="flex items-center gap-3 rounded-xl bg-black/50 border border-orange-500/30 p-2.5"><Rocket className="h-5 w-5 text-orange-400 shrink-0" /><div className="text-left"><b className="text-orange-300">GOLDEN ROCKET</b><div className="text-xs text-slate-400">Massive speed boost + smash through everything</div></div></div>
              <div className="flex items-center gap-3 rounded-xl bg-black/50 border border-sky-500/30 p-2.5"><Shield className="h-5 w-5 text-sky-400 shrink-0" /><div className="text-left"><b className="text-sky-300">DREAM SHIELD</b><div className="text-xs text-slate-400">Survive one crash</div></div></div>
              <div className="flex items-center gap-3 rounded-xl bg-black/50 border border-fuchsia-500/30 p-2.5"><Magnet className="h-5 w-5 text-fuchsia-400 shrink-0" /><div className="text-left"><b className="text-fuchsia-300">MAGNET</b><div className="text-xs text-slate-400">Auto-attracts nearby $DREAM coins</div></div></div>
              <div className="flex items-center gap-3 rounded-xl bg-black/50 border border-emerald-500/30 p-2.5"><Coins className="h-5 w-5 text-emerald-400 shrink-0" /><div className="text-left"><b className="text-emerald-300">X2 COINS</b><div className="text-xs text-slate-400">Double coins for 12 seconds</div></div></div>
            </div>
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 p-2.5 text-xs text-slate-300 text-left">
              <b className="text-red-300">AVOID:</b> striped barriers (jump), laser gates (slide), bear-market walls, neon taxis & falling blocks (change lane). Speed keeps rising — survive!
            </div>
            <button onClick={() => { sound.click(); setShowHow(false); if (phase === 'menu') startGame(); }} className="btn-gold w-full mt-4"><Play className="h-5 w-5" /> {phase === 'menu' ? 'START RUN' : 'GOT IT'}</button>
          </div>
        </div>
      )}

      {/* ================= LEADERBOARD ================= */}
      {showBoard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" data-scroll>
          <div className="menu-panel w-full max-w-md">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black tracking-widest gold-text flex items-center gap-2"><Trophy className="h-6 w-6" /> LEADERBOARD</h3>
              <button onClick={() => { sound.click(); setShowBoard(false); }} className="icon-btn"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-1.5 max-h-[50vh] overflow-y-auto pr-1" data-scroll>
              {boardEntries().map((e, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${e.you ? 'border-amber-400/70 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <span className={`w-7 text-center font-black ${i === 0 ? 'text-amber-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'}`}>
                    {i < 3 ? <Medal className="h-5 w-5 mx-auto" /> : `#${i + 1}`}
                  </span>
                  <span className={`flex-1 text-left font-bold text-sm truncate ${e.you ? 'text-amber-200' : 'text-slate-200'}`}>{e.name}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Coins className="h-3 w-3" />{fmt(e.c)}</span>
                  <span className="font-black gold-text text-sm w-16 text-right">{fmt(e.s)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center text-xs text-slate-500 font-bold tracking-widest">YOUR BEST — {fmt(best)}</div>
            <button onClick={() => { sound.click(); setShowBoard(false); if (phase === 'menu') startGame(); }} className="btn-gold w-full mt-3"><Play className="h-5 w-5" /> {phase === 'menu' ? 'BEAT THEM' : 'CLOSE'}</button>
          </div>
        </div>
      )}

      {/* ================= ANDROID / APK ================= */}
      {showApk && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" data-scroll>
          <div className="menu-panel w-full max-w-lg text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-black tracking-widest gold-text flex items-center gap-2">
                <Smartphone className="h-6 w-6" /> ANDROID APP
              </h3>
              <button onClick={() => { sound.click(); setShowApk(false); }} className="icon-btn"><X className="h-5 w-5" /></button>
            </div>

            {isNative() ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4 text-center">
                <Check className="mx-auto h-8 w-8 text-emerald-400" />
                <div className="mt-2 font-black text-emerald-300 tracking-widest">NATIVE APK ✓</div>
                <div className="mt-1 text-xs text-slate-300">You are running the real Android build.<br />v1.0 · com.dreamrun.game · offline-first</div>
              </div>
            ) : standalone ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4 text-center">
                <Check className="mx-auto h-8 w-8 text-emerald-400" />
                <div className="mt-2 font-black text-emerald-300 tracking-widest">INSTALLED ✓</div>
                <div className="mt-1 text-xs text-slate-300">DREAM RUN is installed and works offline.<br />Launch it from your home screen like any app.</div>
              </div>
            ) : (
              <>
                {canInstall ? (
                  <button onClick={handleInstall} className="btn-gold w-full mt-4"><Download className="h-5 w-5" /> INSTALL NOW</button>
                ) : (
                  <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                    <div className="font-black text-amber-300 tracking-widest text-sm flex items-center gap-2"><Share className="h-4 w-4" /> INSTALL IN CHROME (30 SEC)</div>
                    <ol className="mt-2 space-y-1.5 text-xs text-slate-200 font-semibold list-decimal list-inside">
                      <li>Tap <b>⋮</b> menu (top-right of Chrome)</li>
                      <li>Tap <b>“Add to Home screen”</b> or <b>“Install app”</b></li>
                      <li>Confirm <b>Install</b> — done, plays offline!</li>
                    </ol>
                  </div>
                )}
                <div className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
                  <div className="font-black text-emerald-300 tracking-widest text-sm flex items-center gap-2"><Package className="h-4 w-4" /> NATIVE .APK READY</div>
                  <div className="mt-1 text-xs text-slate-300 font-semibold">This project builds a real installable APK via Capacitor (no PWA wrapper):</div>
                  <ol className="mt-2 space-y-1.5 text-xs text-slate-200 font-semibold list-decimal list-inside">
                    <li>Push this project to GitHub</li>
                    <li>Open the <b>Actions</b> tab → <b>Android APK</b> → download <b>dream-run.apk</b></li>
                    <li>Send the APK to your phone → tap to install → play 🚀</li>
                  </ol>
                  <div className="mt-2 text-[11px] text-slate-400">No Play account needed for testing. Play-ready .aab is built too. See ANDROID_APK_GUIDE.md in the project.</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="stat-card"><Zap className="mx-auto h-4 w-4 text-amber-300" /><div className="stat-val !text-[13px]">FULLSCREEN</div><div className="stat-label">NO URL BAR</div></div>
                  <div className="stat-card"><WifiOff className="mx-auto h-4 w-4 text-amber-300" /><div className="stat-val !text-[13px]">OFFLINE</div><div className="stat-label">PLAY ANYWHERE</div></div>
                  <div className="stat-card"><Vibrate className="mx-auto h-4 w-4 text-amber-300" /><div className="stat-val !text-[13px]">HAPTICS</div><div className="stat-label">BUZZ FEEDBACK</div></div>
                </div>
              </>
            )}
            <button onClick={() => { sound.click(); setShowApk(false); }} className="btn-ghost w-full mt-4">CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}
