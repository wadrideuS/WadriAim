/** Browser input ownership: one listener set, explicitly disposed on teardown. */
export class PlayerInput {
  constructor(canvas, { onLook, onClick, onJump, onReload, onUnlock }) {
    this.canvas = canvas;
    this.keys = new Set();
    this.fire = false;
    this.ads = false;
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    // pointerrawupdate fires as soon as the mouse reports (no waiting for the next frame);
    // browsers without it fall back to mousemove.
    this.rawEvents = 'onpointerrawupdate' in window;
    document.addEventListener(
      this.rawEvents ? 'pointerrawupdate' : 'mousemove',
      (e) => {
        if (
          document.pointerLockElement === canvas ||
          (this.fallback && this.enabled && e.target === canvas)
        )
          onLook(e.movementX, e.movementY);
      },
      options,
    );
    canvas.addEventListener(
      'mousedown',
      (e) => {
        if (e.button === 0) {
          this.fire = true;
          onClick();
        }
        if (e.button === 2) this.ads = true;
      },
      options,
    );
    window.addEventListener(
      'mouseup',
      (e) => {
        if (e.button === 0) this.fire = false;
        if (e.button === 2) this.ads = false;
      },
      options,
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.enabled) return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (
          [
            'w',
            'a',
            's',
            'd',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'Shift',
            'Control',
            ' ',
          ].includes(key)
        ) {
          e.preventDefault();
          this.keys.add(key);
        }
        if (key === ' ' && !e.repeat) onJump();
        if (key === 'r' && !e.repeat) onReload();
      },
      options,
    );
    window.addEventListener(
      'keyup',
      (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key),
      options,
    );
    window.addEventListener(
      'blur',
      () => {
        this.clear();
        onUnlock();
      },
      options,
    );
    document.addEventListener(
      'pointerlockchange',
      () => {
        if (document.pointerLockElement !== canvas) {
          this.clear();
          onUnlock();
        }
      },
      options,
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.clear();
          onUnlock();
        }
      },
      options,
    );
    // Ctrl is crouch; cancel browser zoom only while the arena owns input.
    window.addEventListener('wheel', (event) => {
      if (this.enabled && (event.ctrlKey || this.keys.has('Control'))) event.preventDefault();
    }, { ...options, passive: false, capture: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), options);
  }
  /**
   * Raw input (unadjustedMovement) skips Windows pointer acceleration, the same
   * way VALORANT reads the mouse, so 0.07° × sens per count matches the game.
   */
  async lock() {
    try {
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
      this.rawInput = true;
    } catch (error) {
      if (document.pointerLockElement === this.canvas) return;
      this.rawInput = false;
      await this.canvas.requestPointerLock();
    }
  }
  clear() {
    this.keys.clear();
    this.fire = false;
    this.ads = false;
  }
  dispose() {
    this.abort.abort();
    this.clear();
  }
}
