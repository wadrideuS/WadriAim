import {SpikeAudio} from '../audio/SpikeAudio.js';
import {installSpikeLobby} from '../features/spike-lobby.js';
import {SpikeRoom} from './SpikeRoom.js';
import {resetSpike,damageSpikeBot} from './SpikeDefense.js';
import {canWalkHaven,havenSpawn} from './haven-map.js';
import { showSessionSummary } from '../features/session-summary/index.js';
import { installKeystrokes } from '../features/keystrokes.js';
import { getModeRecords } from '../account/service.js';
import { setLiveActivity } from '../features/live-activity.js';
import { renderModeGuide } from '../data/mode-guides.js';
import { TrainingSession } from './TrainingSession.js';
import { PlayerInput } from './PlayerInput.js';
import { arsenal, weaponDamage } from '../data/weapons.js';
import { exercises } from '../data/exercises.js';
import { cross } from '../features/crosshair-code.js';
import { read, save } from '../lib/storage.js';
import { WeaponAudio } from '../audio/WeaponAudio.js';
import { skinNames } from '../data/finishes.js';
import { installArenaSettings } from '../features/arena-settings.js';
import { decorateVolumeField } from '../features/volume-field.js';
import { buildEntryPanel } from '../features/entry-panel.js';
import { weaponCard, paintWeaponInfo } from '../features/weapon-card.js';
const $ = (id) => document.getElementById(id);

/** Connects DOM, input, simulation and GPU renderer; owns their lifecycle. */
export class TrainingController {
  constructor({ getProfile, onComplete, music, updateProfile, onShowTraining, onShowProgress }) {
    this.music = music;
    this.updateProfile = updateProfile;
    this.modeBrief = document.createElement('section');
    this.modeBrief.className = 'mode-brief';
    this.modeBrief.setAttribute('aria-label', 'Cómo jugar este modo');
    $('instructions').after(this.modeBrief);
    this.communityRecord = document.createElement('p');
    this.communityRecord.className = 'community-record';
    this.entryPanel = buildEntryPanel($('overlay'), { record: this.communityRecord });
    this.spikeLobby=installSpikeLobby(this.entryPanel,{
      onChange:options=>{if(![11,12].includes(this.session?.mode) || this.session.status!=='ready')return;if(options.partner!=='friend')this.leaveSpikeRoom();options={...options,spawn:read('wa-spawns',{})[this.session.mode]||null};this.session.spikeOptions=options;resetSpike(this.session,options);this.draw();},
      onCreate:()=>this.openSpikeRoom(),onJoin:code=>this.openSpikeRoom(code),onLeave:()=>this.leaveSpikeRoom(),
    });
    this.modeBrief.after(this.spikeLobby.root);
    this.spikeAudio=new SpikeAudio();
    this.audio = new WeaponAudio();
    // flash drill: white-out layer and ability callout
    this.blindLayer = document.createElement('div');
    this.blindLayer.className = 'blind-layer';
    this.drillCallout = document.createElement('div');
    this.drillCallout.className = 'drill-callout';
    this.drillCallout.setAttribute('role', 'status');
    $('arena').append(this.blindLayer, this.drillCallout);
    this.resultBanner=document.createElement('div');this.resultBanner.className='defense-result-banner';this.resultBanner.hidden=true;$('arena').append(this.resultBanner);
    this.audio.setVolume(read('wa-volume', 0.35));
    this.audio.setMuted(read('wa-muted', false));
    this.getProfile = getProfile;
    this.onComplete = onComplete;
    this.onShowTraining = onShowTraining;
    this.onShowProgress = onShowProgress;
    this.finishChoices = read('wa-finishes', {});
    this.weaponChoices = read('wa-weapons', {});
    this.session = new TrainingSession();
    this.keystrokes = installKeystrokes($('canvas').parentElement);
    this.abort = new AbortController();
    this.options = { signal: this.abort.signal };
    this.loadVersion = 0;
    this.loaded = false;
    this.frame = 0;
    this.ownsFullscreen = false;
    $('exit-arena').onclick = () => this.close();
    this.crossCanvas = $('game-crosshair');
    this.crossContext = this.crossCanvas.getContext('2d');
    $('start').onclick = () => this.start();
    $('startfull').onclick = () => this.startFullscreen();
    $('exit').onclick = () => this.close();
    $('game').addEventListener(
      'cancel',
      (e) => {
        e.preventDefault();
        if (this.session.status === 'running') this.pause();
      },
      this.options,
    );
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !$('game').open) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.session.status === 'running') this.pause();
    }, { ...this.options, capture: true });
    document.addEventListener(
      'fullscreenchange',
      () => {
        if ($('game').open) {
          if (!document.fullscreenElement && this.session.status === 'running') this.pause();
          this.renderer?.resize();
          this.draw();
        }
      },
      this.options,
    );
    const full = document.createElement('button');
    full.textContent = 'Pantalla completa ⛶';
    full.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else
        document.documentElement
          .requestFullscreen()
          .then(() => {
            this.ownsFullscreen = true;
          })
          .catch(() => this.notice('El navegador no permitió pantalla completa.'));
    };
    $('game').querySelector('.gamehead').insertBefore(full, $('exit'));
    this.fullButton = full;
    const sound = document.createElement('button');
    sound.textContent = this.audio.muted ? 'Sonido: OFF' : 'Sonido: ON';
    sound.onclick = () => {
      this.audio.setMuted(!this.audio.muted);
      save('wa-muted', this.audio.muted);
      sound.textContent = this.audio.muted ? 'Sonido: OFF' : 'Sonido: ON';
    };
    $('game').querySelector('.gamehead').insertBefore(sound, full);
    this.soundButton = sound;
    // Enemy highlight colour, like the in-game accessibility setting (rojo / amarillo / morado).
    const outlineNames = { rojo: 'ROJO', amarillo: 'AMARILLO', morado: 'MORADO' };
    const outlineKeys = Object.keys(outlineNames);
    this.enemyOutline = outlineKeys.includes(read('wa-enemy-outline', 'rojo'))
      ? read('wa-enemy-outline', 'rojo')
      : 'rojo';
    this.weaponSide = read('wa-weapon-side', 'right');
    this.session.trainingOptions = { ammo: 'reload', timed: true, ...read('wa-training-options', {}) };
    this.arenaSettings = installArenaSettings($('loadout'), {
      options: () => this.session.trainingOptions,
      setOption: (key, value) => {
        if (this.session.status !== 'ready') return;
        this.session.trainingOptions = { ...this.session.trainingOptions, [key]: value };
        save('wa-training-options', this.session.trainingOptions);
        this.session.reset(this.session.mode, this.session.weaponId);
        this.draw();
      },
      profile: () => this.getProfile(),
      updateProfile: (patch) => {
        this.updateProfile?.(patch);
        this.draw();
      },
      outline: () => this.enemyOutline,
      setOutline: (key) => {
        this.enemyOutline = key;
        save('wa-enemy-outline', key);
        this.renderer?.setEnemyOutline(key);
        this.draw();
      },
      weaponSide: () => this.weaponSide,
      setWeaponSide: (side) => {
        this.weaponSide = side;
        save('wa-weapon-side', side);
        this.renderer?.setWeaponSide(side);
        this.draw();
      },
      music: () => this.music,
      setQuality: (mode) => {
        this.renderer?.setQuality(mode);
        this.draw();
      },
    });
    this.endRound = document.createElement('button');
    this.endRound.type = 'button';
    this.endRound.className = 'end-round';
    this.endRound.textContent = 'Terminar y ver resultados';
    this.endRound.hidden = true;
    this.endRound.onclick = () => {
      if (this.session.status === 'paused') this.publishSummary(true);
    };
    $('startfull').before(this.endRound);
    // Haven / Supervivencia: choose where you start next round
    this.spawnRow = document.createElement('div');
    this.spawnRow.className = 'setting-row spawn-row';
    const spawnLabel = document.createElement('span');
    spawnLabel.className = 'setting-label';
    spawnLabel.textContent = 'Tu inicio';
    const spawnHere = document.createElement('button');
    spawnHere.type = 'button';
    spawnHere.className = 'end-round';
    spawnHere.textContent = 'Aparecer aquí';
    const spawnReset = document.createElement('button');
    spawnReset.type = 'button';
    spawnReset.className = 'end-round';
    spawnReset.textContent = 'Inicio original';
    this.spawnInfo = document.createElement('small');
    this.spawnInfo.className = 'setting-hint';
    const saveSpawn = (value) => {
      const all = { ...read('wa-spawns', {}) };
      if (value) all[this.session.mode] = value;
      else delete all[this.session.mode];
      save('wa-spawns', all);
      this.session.spikeOptions = { ...this.session.spikeOptions, spawn: value };
      this.paintSpawn();
    };
    spawnHere.onclick = () => {
      const p = this.session.position;
      saveSpawn({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +this.session.yaw.toFixed(3) });
    };
    spawnReset.onclick = () => saveSpawn(null);
    this.spawnRow.append(spawnLabel, spawnHere, spawnReset, this.spawnInfo);
    this.arenaSettings.root.querySelector('.settings-block:last-child').append(this.spawnRow);
    const label = document.createElement('label');
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '100';
    volume.value = String(this.audio.volume * 100);
    volume.setAttribute('aria-label', 'Volumen de los efectos');
    volume.oninput = () => {
      this.audio.setVolume(Number(volume.value) / 100);
      save('wa-volume', this.audio.volume);
    };
    decorateVolumeField(label, volume, 'effects', 'Volumen de los efectos');
    $('form').insertBefore(label, $('form').querySelector('button.primary'));
    this.volumeControl = label;
  }
  processEvents() {
    const fatalTimes = new Set(
      this.session.events.filter((e) => !e.sounded && e.type === 'kill').map((e) => e.time),
    );
    for (const event of this.session.events) {
      if (event.sounded) continue;
      event.sounded = true;
      if (
        event.type === 'impact' &&
        !(['vandal', 'sheriff'].includes(this.session.weaponId) && fatalTimes.has(event.time))
      )
        this.audio.impact(event.part, this.session.weaponId);
      if(event.type==='enemy-shot')this.audio.positionalNpcShot(event,this.session);
      if (event.type === 'track-hit') this.audio.trackTick();
      if (event.type === 'flash-cue') this.audio.flashCue(event.kind);
      if (event.type === 'flash-pop') this.audio.flashPop(event.kind);
      if (event.type === 'kill')
        this.audio.confirm(event.part === 'head', this.session.weaponId, event.killCount);
    }
  }
  triggerShot() {
    if (this.session.status !== 'running' || this.session.course) return;
    const shotsBefore=this.session.shots;
    const reloadBefore = this.session.reloadLeft;
    if (this.session.shoot()) {
      if (!this.audio.combinedHitAvailable(this.session.weaponId, this.session.events))
        this.audio.shot(this.session.weaponId);
    } else if (this.session.ammo === 0 && this.session.reloadLeft === 0) this.audio.dry();
    if (reloadBefore === 0 && this.session.reloadLeft > 0)
      this.audio.reload(this.session.weaponId, this.session.weapon.reload);
    if(this.room && !this.room.host && this.session.shots>shotsBefore)this.room.send({kind:'fire',...this.peerInput()});
    this.processEvents();
  }
  triggerReload() {
    if(this.session.course)return;
    const before = this.session.reloadLeft;
    this.session.reload();
    if(this.room && !this.room.host)this.room.send({kind:'reload'});
    if (before === 0 && this.session.reloadLeft > 0)
      this.audio.reload(this.session.weaponId, this.session.weapon.reload);
  }
  async ensureRenderer() {
    if (this.renderer) return;
    const { ArenaRenderer } = await import('../renderer/ArenaRenderer.js');
    this.renderer = new ArenaRenderer($('canvas'), {
      onAssetStatus: (text) => {
        $('asset-status').textContent = text;
        $('asset-status').hidden = !text;
      },
    });
    this.renderer.setEnemyOutline(this.enemyOutline || 'rojo');
    this.renderer.setWeaponSide(this.weaponSide);
    if (read('wa-quality', 'quality') === 'performance') this.renderer.setQuality('performance');
    this.session.hitTest = (offset) => {
      this.renderer.sync(this.session);
      return this.renderer.cast(offset);
    };
    this.input = new PlayerInput($('canvas'), {
      onLook: (x, y) => this.session.look(x, y, this.getProfile().sens),
      onClick: () => this.triggerShot(),
      onJump: () => this.session.jump(),
      onReload: () => this.triggerReload(),
      onUnlock: () => this.pause(),
    });
  }
  async open(mode) {
    this.clearSummary?.();this.clearSummary=null;this.recorded=false;this.leaveSpikeRoom();
    this.session.spikeOptions={difficulty:'basic',partner:'solo',spawn:read('wa-spawns',{})[mode]||null};
    this.spikeLobby.reset();this.spikeLobby.show([11,12].includes(mode),mode===12);
    this.resultBanner.hidden=true;clearTimeout(this.finishTimer);this.spikeAudio.stop();
    $('start').textContent = 'Iniciar';
    cancelAnimationFrame(this.frame);
    const weapon = [7,8,9].includes(mode) ? 'karambit' : arsenal[this.weaponChoices[mode]] && this.weaponChoices[mode] !== 'karambit' ? this.weaponChoices[mode] : 'vandal';
    this.session.reset(mode, weapon);
    $('game').showModal();
    $('title').textContent = exercises[mode][0] + ' / ARENA 3D';
    renderModeGuide(this.modeBrief, mode);
    this.communityRecord.hidden = false;
    this.communityRecord.textContent = 'Cargando récord de la comunidad…';
    void getModeRecords(mode).then(rows => {
      if (this.session.mode !== mode || !$('game').open) return;
      this.communityRecord.textContent = rows.length ? `RÉCORD DE OTROS JUGADORES · @${rows[0].username} · ${rows[0].score} ${mode === 6 || mode >= 7 ? 'puntos' : 'aciertos'}` : 'Aún no hay marcas de otros jugadores en este modo. ¡Sé el primero!';
    }).catch(() => { if(this.session.mode === mode) this.communityRecord.textContent = 'El récord de la comunidad no está disponible en este momento.'; });
    $('result').textContent = exercises[mode][0];
    this.entryPanel.querySelector('.eyebrow').textContent=exercises[mode][1];
    $('instructions').textContent =
      mode === 2
        ? 'Mantén pulsado el disparo mientras sigues al bot.'
        : 'Apunta y dispara a los bots. Detente para mejorar la precisión.';
    if (this.session.course) $('instructions').textContent = 'WASD · Espacio para saltar · Shift para caminar. Sigue las plataformas iluminadas en orden.';
    if (mode === 10) $('instructions').textContent='Los bots asoman por turnos. Espera a que salgan de la cobertura y reacciona.';
    if (mode === 13) $('instructions').textContent='Escucha el aviso, lee qué habilidad viene y reacciona: gira, muévete o dispárale. Después asoma un enemigo.';
    if (mode === 14) $('instructions').textContent='Strafe, agachadas, coberturas, ventanas y torres. Ajusta la altura de tu mira.';
    if (mode === 6)
      $('instructions').textContent =
        '45 segundos · objetivos de 650 ms · munición ilimitada. Más velocidad y racha, más puntos.';
    this.notice('');
    $('overlay').hidden = false;
    this.entryPanel.querySelector('.entry-body').scrollTo(0, 0);
    $('loadout').hidden = false;
    this.endRound.hidden = true;
    this.arenaSettings.refresh('ready');
    this.paintSpawn();
    try {
      await this.ensureRenderer();
      await this.renderer.prepareMode(mode);
      // gloved FPS arms with a real rifle grip (the agent sleeves looked stretched)
      this.renderer.agentId='fpshands';
      this.renderer.resize();
      this.loadout();
      this.draw();
      await this.loadModels(weapon);
    } catch (error) {
      this.notice('No se pudo abrir la arena 3D: ' + error.message);
      this.enableStart(false);
    }
  }
  enableStart(enabled) {
    $('start').disabled = !enabled;
    $('startfull').disabled = !enabled;
  }
  async loadModels(id) {
    const token = ++this.loadVersion;
    this.loaded = false;
    this.enableStart(false);
    try {
      await this.renderer.equip(id, this.finishChoices[id] || 'original');
      if (token !== this.loadVersion) return;
      this.loaded = true;
      this.enableStart(true);
      this.draw();
    } catch (error) {
      if (token === this.loadVersion)
        this.notice(
          'No se pudo descargar el modelo. Revisa tu conexión y vuelve a elegir el arma.',
        );
    }
  }
  loadout() {
    const root = $('weapons');
    root.replaceChildren();
    Object.entries(arsenal).filter(([id]) => this.session.course ? id === 'karambit' : id !== 'karambit').forEach(([id, weapon]) => {
      const button = weaponCard(id, weapon, id === this.session.weaponId);
      button.onclick = async () => {
        this.session.chooseWeapon(id);
        this.weaponChoices[this.session.mode] = id;
        save('wa-weapons', this.weaponChoices);
        this.loadout();
        root.querySelector('.selected')?.focus();
        await this.loadModels(id);
      };
      root.append(button);
    });
    const weapon = this.session.weapon;
    paintWeaponInfo($('weaponinfo'), this.session.course
      ? { name: weapon.name, details: ['Solo cuchillo', 'Circuitos progresivos'] }
      : { name: weapon.name, details: [skinNames[this.session.weaponId], weapon.type] });

    $('loadout').hidden = false;
    this.arenaSettings.refresh(this.session.status);
  }
  notice(text) {
    $('entrynotice').textContent = text;
  }
  async start() {
    if (!this.loaded) return;
    if (document.fullscreenElement) {
      try { await navigator.keyboard?.lock?.(['Escape']); } catch {}
    }
    if([11,12].includes(this.session.mode) && this.session.spike.partner==='friend'){
      if(!this.room?.peer){this.notice('Crea una sala o únete a la de tu amigo. Deben estar los dos dentro.');return;}
      if(this.room.host && !this.peerReady){this.notice('Espera a que tu amigo pulse Listo.');return;}
      if(!this.room.host){this.peerReady=true;this.room.send({kind:'input',...this.peerInput(),ready:true});}
    }
    if([11,12].includes(this.session.mode))void this.spikeAudio.unlock();
    const startVersion = this.loadVersion;
    const audioReady = this.audio
      .unlock()
      .then(() => this.session.course ? undefined : Promise.all([this.audio.prime(this.session.weaponId),this.session.spike?this.audio.prime('npc-vandal'):Promise.resolve()]))
      .catch(() => {});
    this.input.fallback = false;
    this.notice('');
    try {
      await this.input.lock();
    } catch {
      this.input.fallback = true;
      $('asset-status').hidden = false;
      $('asset-status').textContent =
        'Control alternativo: mueve el ratón dentro de la arena. Chrome o Edge permiten la captura continua.';
    }
    await audioReady;
    if (!$('game').open || startVersion !== this.loadVersion) return;
    this.music?.duck(true);
    this.session.start();
    setLiveActivity('playing', this.session.mode);
    this.input.enabled = true;
    this.input.clear();
    this.keystrokes.clear();
    $('overlay').hidden = true;
    this.lastTime = performance.now();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((now) => this.loop(now));
  }
  async startFullscreen() {
    if (!this.loaded) return;
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        this.ownsFullscreen = true;
        this.renderer.resize();
      } catch {
        this.notice(
          'El navegador no permitió pantalla completa. Usa el botón rosa o vuelve a intentarlo.',
        );
        return;
      }
    }
    // Supported desktop browsers can reserve Escape for the pause menu.
    try { await navigator.keyboard?.lock?.(['Escape']); } catch {}
    if (this.session.status === 'ready') await this.start();
  }
  paintSpawn() {
    const spike = [11, 12].includes(this.session.mode);
    this.spawnRow.hidden = !spike || this.session.status !== 'paused';
    if (!spike) return;
    const saved = read('wa-spawns', {})[this.session.mode];
    const p = this.session.position;
    this.spawnInfo.textContent =
      `Estás en x ${p.x.toFixed(1)} · z ${p.z.toFixed(1)}` +
      (saved ? ` · inicio guardado: x ${saved.x} · z ${saved.z} (desde la próxima ronda)` : ' · inicio original');
  }
  pause() {
    if (this.session.status !== 'running') return;
    this.music?.duck(false);
    this.spikeAudio.pause();
    this.audio.stop({ preserveTails: true });
    this.session.pause();
    setLiveActivity('paused', this.session.mode);
    this.input.enabled = false;
    this.input.clear();
    this.keystrokes.clear();
    cancelAnimationFrame(this.frame);
    if (document.pointerLockElement) document.exitPointerLock();
    $('overlay').hidden = false;
    $('loadout').hidden = false;
    this.arenaSettings.refresh('paused');
    this.paintSpawn();
    this.endRound.hidden = false;
    this.loadout();
    this.modeBrief.hidden = true;
    this.communityRecord.hidden = true;
    $('result').textContent = 'Sesión en pausa';
    $('instructions').textContent = 'Continúa cuando estés listo.';
    $('start').textContent = 'Continuar';
    if(this.room && !this.room.host)this.room.send({kind:'pause'});
  }
  finish() {
    if([11,12].includes(this.session.mode)){
      if(this.finishing)return;this.finishing=true;
      const won=this.session.spike.outcome==='defended';
      this.resultBanner.hidden=false;this.resultBanner.classList.toggle('victory',won);
      this.resultBanner.textContent=won?'VICTORIA':'DERROTA';
      if(won)this.spikeAudio.pause();
      this.input.enabled=false;this.input.clear();this.keystrokes.clear();
      if(this.room?.host)this.networkFrame();
      this.finishTimer=setTimeout(()=>{this.finishing=false;this.resultBanner.hidden=true;this.publishSummary(false);},2200);
      return;
    }
    this.publishSummary(false);
  }
  publishSummary(early) {
    if(this.recorded)return;
    this.recorded=true;
    const result={...this.session.result(),early};
    this.onComplete(result);
    const mode=this.session.mode;
    this.close({summary:false});
    this.clearSummary = showSessionSummary(result, {
      shots: this.session.shotLog,
      history: read('wa-history', []),
      onReplay: () => this.open(mode),
      onHome: this.onShowTraining,
      onProgress: this.onShowProgress,
    });
  }
  loop(now) {
    if (this.session.status !== 'running') return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const before = this.session.shots,
      reloadBefore = this.session.reloadLeft;
    this.session.tick(dt, this.input);
    if (
      this.session.shots > before &&
      !this.audio.combinedHitAvailable(this.session.weaponId, this.session.events)
    )
      this.audio.shot(this.session.weaponId, true);
    if(this.room && !this.room.host && this.session.shots>before)this.room.send({kind:'fire',...this.peerInput()});
    this.processEvents();
    if (reloadBefore === 0 && this.session.reloadLeft > 0)
      this.audio.reload(this.session.weaponId, this.session.weapon.reload);
    this.draw(dt);
    if (this.session.status === 'finished') {
      this.finish();
      return;
    }
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }
  draw(dt = 0) {
    this.keystrokes.update(this.session,this.input?.keys);
    this.spikeAudio.sync(this.session,{volume:this.audio.volume,muted:this.audio.muted});
    $('arena').classList.toggle('damage-flash',Boolean(this.session.spike && this.session.hurtUntil>this.session.elapsed));
    if (!this.renderer) return;
    this.renderer.render(this.session, dt);
    const width = this.renderer.width || 800,
      height = this.renderer.height || 500;
    const ratio = Math.min(devicePixelRatio, 2);
    if (
      this.crossCanvas.width !== Math.round(width * ratio) ||
      this.crossCanvas.height !== Math.round(height * ratio)
    ) {
      this.crossCanvas.width = Math.round(width * ratio);
      this.crossCanvas.height = Math.round(height * ratio);
    }
    this.crossContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.crossContext.clearRect(0, 0, width, height);
    cross(this.crossContext, width / 2, height / 2, this.getProfile().code);
    if (this.session.hitmarker > 0) {
      const c = this.crossContext;
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      for (const [x, y] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        c.beginPath();
        c.moveTo(width / 2 + x * 9, height / 2 + y * 9);
        c.lineTo(width / 2 + x * 15, height / 2 + y * 15);
        c.stroke();
      }
    }
    $('hit-feedback').textContent =
      this.session.feedback?.until > this.session.elapsed ? this.session.feedback.text : '';
    const s = this.session,
      endless = !s.spike?.survival && !Number.isFinite(s.remaining),
      time = Math.ceil(s.spike?.survival || endless ? s.totalElapsed : s.remaining);
    $('counter').textContent = `${time}s · ${s.hits} ${s.mode === 2 ? 'puntos' : 'aciertos'}`;
    $('hud-hits').textContent = s.mode === 13 ? s.score : s.hits;
    $('hud-headshots').textContent=s.course?`${s.completedCourses} circuitos completados`:s.drill?`${s.drill.dodged} esquivas · ${s.drill.flashed} cegado · ${s.hits} bajas`:`${s.headshots} headshots`;
    const drill = s.drill;
    const blind = drill ? Math.min(1, drill.blind / 0.45) : 0;
    this.blindLayer.style.opacity = String(blind);
    const callout = drill?.callout && drill.callout.until > s.elapsed ? drill.callout : null;
    this.drillCallout.hidden = !callout;
    if (callout) {
      this.drillCallout.dataset.kind = callout.kind;
      this.drillCallout.innerHTML = '';
      const name = document.createElement('strong');
      name.textContent = `${callout.name} · ${callout.agent}`;
      const hint = document.createElement('span');
      hint.textContent = callout.hint;
      this.drillCallout.append(name, hint);
    }
    $('round-clock').textContent = $('hud-time').textContent =
      `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
    if (endless) $('hud-time').textContent = '∞ ' + $('hud-time').textContent;
    $('round-clock').parentElement.classList.toggle('urgent', !endless && time <= 10);
    $('hud-accuracy').textContent =
      `${s.shots ? Math.round((s.hits / s.shots) * 100) : 0}% · ${s.shots} disparos`;
    $('hud-ammo').textContent = s.course ? `VIDAS ${s.lives}/10 · NIVEL ${s.courseLevel}/10 · PLATAFORMAS ${s.courseStep}/${s.course.pads.length-1} · CAÍDAS ${s.falls}` :
      (s.spike?`HP ${s.health}/150 · ${s.spike.survival?`OLEADA ${s.spike.wave}${s.spike.phase==='rest'?' · DESCANSO '+Math.ceil(s.spike.restLeft)+'s':''}`:'ENEMIGOS '+s.targets.filter(t=>!t.dead).length+'/5 · DESACTIVACIÓN '+Math.round(s.spike.defuse/7*100)+'%'} · `:'')+s.weapon.name.toUpperCase() +
      ' ' +
      (s.reloadLeft > 0 ? 'RECARGANDO…' : s.infiniteAmmo ? '∞' : `${s.ammo} / ${s.weapon.mag}`);
    const p = this.getProfile();
    $('hud-profile').textContent =
      `SENS ${p.sens} / ${p.dpi} DPI / ${Math.round(p.sens * p.dpi)} eDPI`;
  }
  leaveSpikeRoom(){
    clearInterval(this.networkTimer);this.networkTimer=null;
    this.room?.close();this.room=null;this.peerReady=false;
    if(this.session){this.session.networkRole=null;this.session.defenderSlot=0;}
  }
  async openSpikeRoom(code){
    this.leaveSpikeRoom();this.spikeLobby.message('Conectando a la sala…');
    const room=new SpikeRoom({mode:this.session.mode,onMessage:(payload,sender)=>this.receiveSpikeMessage(payload,sender),onMembers:(info,host)=>{this.spikeLobby.room(info,host);$('start').textContent=host?'Iniciar defensa':'Listo';},onError:text=>this.spikeLobby.message(text)});
    this.room=room;
    try{await room.open(code);if(!$('game').open){this.leaveSpikeRoom();return;}
      this.session.networkRole=room.host?'host':'guest';this.peerReady=false;
      this.session.defenderSlot=Math.max(0,room.info.members.findIndex(m=>m.id===room.userId));
      this.session.spikeOptions={...this.spikeLobby.options(),partner:'friend'};resetSpike(this.session,this.session.spikeOptions);
      this.session.remotePlayers={};
      this.networkTimer=setInterval(()=>this.networkFrame(),80);this.draw();
    }catch(error){this.leaveSpikeRoom();throw error;}
  }
  peerInput(){const s=this.session;return {x:s.position.x,y:s.position.y,z:s.position.z,yaw:s.yaw,pitch:s.pitch,weapon:s.weaponId,ready:this.peerReady};}
  networkFrame(){
    if(!this.room || ![11,12].includes(this.session.mode))return;
    const s=this.session;
    if(this.room.host){
      for(const [id,player] of Object.entries(s.remotePlayers||{}))if(performance.now()-(this.room.lastSeen.get(id)||0)>12000 && s.status==='running')player.hp=0;
      const players={...s.remotePlayers,[this.room.userId]:{...s.position,hp:s.health,yaw:s.yaw,weapon:s.weaponId}};
      this.room.send({kind:'state',status:s.status,elapsed:s.elapsed,totalElapsed:s.totalElapsed,remaining:Number.isFinite(s.remaining)?s.remaining:null,targets:s.targets.map(({id,x,y,z,hp,dead,yaw})=>({id,x,y,z,hp,dead,yaw})),spike:s.spike,players,stats:s.remoteStats});
    }else this.room.send({kind:'input',...this.peerInput()});
  }
  receiveSpikeMessage(payload,sender){
    if(!payload || !this.room || ![11,12].includes(this.session.mode))return;
    const s=this.session;
    if(this.room.host){
      if(!this.room.info.members.some(m=>m.id===sender))return;
      if(payload.kind==='pause'){this.pause();return;}
      const existing=s.remotePlayers[sender];
      if(payload.kind==='reload'){if(existing){existing.reloadAt=s.elapsed+arsenal[existing.weapon||'vandal'].reload;existing.ammo=arsenal[existing.weapon||'vandal'].mag;}return;}
      if(!['input','fire'].includes(payload.kind))return;
      if(!['x','z','yaw','pitch'].every(k=>Number.isFinite(payload[k]))||!s.navigation.canWalk(payload.x,payload.z)||Math.abs(payload.pitch)>1.45)return;
      const p=existing||{hp:150,ammo:25,nextShot:0,reloadAt:0,weapon:'vandal'};
      if(existing && s.status==='running' && (Math.hypot(p.x-payload.x,p.z-payload.z)>3||s.navigation.blocked(p,payload)))return;
      if(s.status==='ready' && arsenal[payload.weapon] && payload.weapon!=='karambit'){p.weapon=payload.weapon;p.ammo=arsenal[p.weapon].mag;}
      p.x=payload.x;p.z=payload.z;p.y=Number.isFinite(payload.y)?Math.min(6,Math.max(1,payload.y)):1.65;p.yaw=payload.yaw;p.pitch=payload.pitch;p.ready=Boolean(payload.ready);s.remotePlayers[sender]=p;
      this.peerReady=Object.values(s.remotePlayers).filter(p=>p.hp>0).every(p=>p.ready);
      s.remoteStats[sender] ||= {hits:0,headshots:0,shots:0,score:0};
      if(payload.kind==='fire' && s.status==='running' && p.hp>0){
        const weapon=arsenal[p.weapon||'vandal'];
        if(s.elapsed<(p.nextShot||0)-.018||s.elapsed<(p.reloadAt||0))return;
        if(p.ammo===undefined)p.ammo=weapon.mag;if(p.ammo<=0){p.reloadAt=s.elapsed+weapon.reload;p.ammo=weapon.mag;return;}
        p.ammo--;p.nextShot=s.elapsed+1/weapon.rate;s.remoteStats[sender].shots++;
        const hit=this.renderer.castFromPose(p),target=hit?s.targets.find(t=>t.id===hit.id&&!t.dead):null;
        if(target)damageSpikeBot(s,target,hit.part,weaponDamage(weapon,hit.part,Math.hypot(target.x-p.x,target.z-p.z)),{userId:sender});
      }
    }else if(payload.kind==='state' && sender===this.room.info.host){
      if(!Array.isArray(payload.targets)||payload.targets.length!==5||!payload.spike||!payload.players||!(payload.remaining===null||Number.isFinite(payload.remaining)))return;
      const me=payload.players[this.room.userId];
      s.targets=payload.targets;s.spike=payload.spike;if(me)s.health=me.hp;
      s.remotePlayers=Object.fromEntries(Object.entries(payload.players).filter(([id])=>id!==this.room.userId));
      s.elapsed=payload.elapsed;s.totalElapsed=payload.totalElapsed;s.remaining=payload.remaining===null?Infinity:payload.remaining;
      const stats=payload.stats?.[this.room.userId];if(stats){s.hits=stats.hits;s.headshots=stats.headshots;s.score=stats.score;s.shots=Math.max(s.shots,stats.shots);}
      if(payload.status==='finished' && !this.recorded){s.status='finished';if(s.spike.outcome==='defended')s.score+=500;this.finish();}
      else if(payload.status==='paused' && s.status==='running' && !this.peerReady)this.pause();
    }
  }
  close({summary=true}={}) {
    if(summary && !this.recorded && this.session.totalElapsed>0){this.publishSummary(this.session.status!=='finished');return;}
    setLiveActivity('browsing');
    this.music?.duck(false);
    navigator.keyboard?.unlock?.();
    this.audio.stop();
    cancelAnimationFrame(this.frame);
    this.loadVersion++;
    clearTimeout(this.finishTimer);this.finishing=false;this.resultBanner.hidden=true;this.spikeAudio.stop();
    this.leaveSpikeRoom();
    this.session.status = 'ready';
    this.input?.clear();
    this.keystrokes.clear();
    if (this.input) this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.ownsFullscreen && document.fullscreenElement) document.exitFullscreen();
    this.ownsFullscreen = false;
    $('game').close();
  }
  dispose() {
    this.close({summary:false});
    this.clearSummary?.();
    this.abort.abort();
    this.fullButton.remove();
    this.soundButton.remove();
    this.arenaSettings.dispose();
    this.endRound.remove();
    this.volumeControl.remove();
    this.input?.dispose();
    this.renderer?.dispose();
    this.audio.dispose();
    this.keystrokes.dispose();
    this.spikeLobby.dispose();
    this.spikeAudio.dispose();this.resultBanner.remove();
  }
}
