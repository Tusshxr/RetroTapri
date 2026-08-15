/**
 * OptionWheel — Vanilla JavaScript Curved Option Wheel / iOS-style Picker
 * 
 * Reusable module implementing a curved 3D option wheel with frame-rate independent
 * exponential smoothing, pointer dragging, mouse wheel scrolling, keyboard navigation,
 * and audio tick feedback.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OptionWheel = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Reusable Web Audio synth for the tactile tick sound
  let sharedAudioCtx = null;
  function getAudioContext() {
    if (!sharedAudioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }

  function playSynthTick(volume = 0.4) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "sine";
      // Crisp retro woody click: quick pitch drop from 1400Hz to 120Hz
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.025);

      gain.gain.setValueAtTime(Math.min(Math.max(volume * 0.35, 0), 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.028);
    } catch (e) {
      // Ignore autoplay or audio context constraints
    }
  }

  class OptionWheel {
    /**
     * @param {HTMLElement|string} container - Parent element or CSS selector
     * @param {Object} options - Configuration options
     */
    constructor(container, options = {}) {
      this.container = typeof container === "string" ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error("[OptionWheel] Invalid container element specified.");
      }

      this.opts = Object.assign(
        {
          items: [],
          defaultSelected: 0,
          onChange: null,
          textColor: "rgba(255, 255, 255, 0.52)",
          activeColor: "#ffffff",
          side: "left",
          fontSize: 1.7, // in rem
          spacing: 1.35,
          curve: 1.0,
          tilt: 6.5, // in degrees
          blur: 2.0,
          fade: 0.26,
          minOpacity: 0.06,
          smoothing: 180, // ms tau
          inset: 42, // px from side
          loop: false,
          draggable: true,
          soundUrl: "",
          soundVolume: 0.45,
          enableSynthSound: true,
          className: "",
          getItemLabel: (item) => (typeof item === "object" && item !== null ? item.title || item.name || item.label : String(item)),
        },
        options
      );

      this.items = this.opts.items || [];
      this.selectedIndex = Math.max(0, Math.min(this.opts.defaultSelected, Math.max(this.items.length - 1, 0)));
      this.pos = this.selectedIndex;
      this.target = this.selectedIndex;
      this.rafId = null;
      this.lastTime = 0;
      this.isDragging = false;
      this.dragInfo = null;
      this.dragMoved = false;
      this.wheelTimer = null;
      this.lastTickTime = 0;
      this.audio = null;
      this.audioUrl = "";
      this.itemEls = [];
      this.remPx = 16;
      this.destroyed = false;

      this._boundRunFrame = this._runFrame.bind(this);
      this._boundOnWheel = this._onWheel.bind(this);
      this._boundOnPointerDown = this._onPointerDown.bind(this);
      this._boundOnPointerMove = this._onPointerMove.bind(this);
      this._boundOnPointerUp = this._onPointerUp.bind(this);
      this._boundOnKeyDown = this._onKeyDown.bind(this);
      this._boundOnResize = this._onResize.bind(this);

      this._init();
    }

    _init() {
      this._updateRemPx();
      this._buildDOM();
      this._bindEvents();
      this._applyTarget(this.target, false, true);
    }

    _updateRemPx() {
      try {
        this.remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      } catch (e) {
        this.remPx = 16;
      }
    }

    _getRowHeight() {
      return Math.max(this.opts.fontSize * this.opts.spacing * this.remPx, 1);
    }

    _buildDOM() {
      this.root = document.createElement("div");
      this.root.className = `option-wheel${this.opts.side === "right" ? " option-wheel--right" : ""}${
        this.opts.className ? " " + this.opts.className : ""
      }`;
      this.root.setAttribute("role", "listbox");
      this.root.setAttribute("tabindex", "0");
      this.root.setAttribute("aria-label", "Option wheel selector");

      this._updateStyleProperties();
      this._renderItems();

      this.container.replaceChildren(this.root);
    }

    _updateStyleProperties() {
      this.root.style.setProperty("--ow-text-color", this.opts.textColor);
      this.root.style.setProperty("--ow-active-color", this.opts.activeColor);
      this.root.style.setProperty("--ow-font-size", `${this.opts.fontSize}rem`);
      this.root.style.setProperty("--ow-inset", `${this.opts.inset}px`);
    }

    _renderItems() {
      this.root.replaceChildren();
      this.itemEls = [];

      this.items.forEach((item, index) => {
        const itemEl = document.createElement("div");
        itemEl.className = `option-wheel__item${index === this.selectedIndex ? " option-wheel__item--selected" : ""}`;
        itemEl.setAttribute("role", "option");
        itemEl.setAttribute("aria-selected", index === this.selectedIndex ? "true" : "false");
        itemEl.dataset.index = String(index);

        const label = this.opts.getItemLabel(item);
        itemEl.textContent = label;

        itemEl.addEventListener("click", () => {
          this._handleItemClick(index);
        });

        this.root.appendChild(itemEl);
        this.itemEls.push(itemEl);
      });
    }

    _bindEvents() {
      this.root.addEventListener("wheel", this._boundOnWheel, { passive: false });
      this.root.addEventListener("pointerdown", this._boundOnPointerDown);
      window.addEventListener("pointermove", this._boundOnPointerMove);
      window.addEventListener("pointerup", this._boundOnPointerUp);
      window.addEventListener("pointercancel", this._boundOnPointerUp);
      this.root.addEventListener("keydown", this._boundOnKeyDown);
      window.addEventListener("resize", this._boundOnResize);
    }

    _unbindEvents() {
      this.root.removeEventListener("wheel", this._boundOnWheel);
      this.root.removeEventListener("pointerdown", this._boundOnPointerDown);
      window.removeEventListener("pointermove", this._boundOnPointerMove);
      window.removeEventListener("pointerup", this._boundOnPointerUp);
      window.removeEventListener("pointercancel", this._boundOnPointerUp);
      this.root.removeEventListener("keydown", this._boundOnKeyDown);
      window.removeEventListener("resize", this._boundOnResize);
    }

    _onResize() {
      this._updateRemPx();
      this._updateStyleProperties();
      this._applyTarget(this.target, false, true);
    }

    _playTick() {
      const now = performance.now ? performance.now() : Date.now();
      if (now - this.lastTickTime < 65) return;
      this.lastTickTime = now;

      if (this.opts.soundUrl) {
        if (!this.audio || this.audioUrl !== this.opts.soundUrl) {
          this.audio = new Audio(this.opts.soundUrl);
          this.audio.preload = "auto";
          this.audioUrl = this.opts.soundUrl;
        }
        this.audio.volume = Math.min(Math.max(this.opts.soundVolume, 0), 1);
        this.audio.currentTime = 0;
        this.audio.play()?.catch(() => {});
      } else if (this.opts.enableSynthSound) {
        playSynthTick(this.opts.soundVolume);
      }
    }

    _startLoop() {
      if (this.rafId != null) {
        cancelAnimationFrame(this.rafId);
      }
      this.lastTime = performance.now ? performance.now() : Date.now();
      this.rafId = requestAnimationFrame(this._boundRunFrame);
    }

    _runFrame(now) {
      if (this.destroyed) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      const tau = Math.max(this.opts.smoothing, 1) / 1000;
      const k = 1 - Math.exp(-dt / tau);

      const target = this.target;
      const cur = this.pos;
      let next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.001;
      if (settled) next = target;
      this.pos = next;

      const els = this.itemEls;
      const n = this.items.length;
      if (n === 0) return;

      const rowH = this._getRowHeight();
      const mirror = this.opts.side === "right" ? -1 : 1;
      const tiltRad = (this.opts.tilt * Math.PI) / 180;
      const R = tiltRad > 0.0005 ? rowH / tiltRad : 0;

      for (let i = 0; i < n; i++) {
        const el = els[i];
        if (!el) continue;
        let d = i - next;
        if (this.opts.loop && n > 1) {
          d = ((d % n) + n) % n;
          if (d > n / 2) d -= n;
        }
        const dist = Math.abs(d);
        let x = 0;
        let y = d * rowH;
        let rot = 0;

        if (R > 0) {
          const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
          y = R * Math.sin(ang);
          x = -mirror * R * (1 - Math.cos(ang)) * this.opts.curve;
          rot = (mirror * ang * 180) / Math.PI;
        }

        el.style.transform = `translate3d(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%), 0) rotate(${rot.toFixed(3)}deg)`;
        el.style.opacity = String(Math.max(this.opts.minOpacity, 1 - dist * this.opts.fade));
        el.style.filter = this.opts.blur > 0 ? `blur(${(dist * this.opts.blur).toFixed(2)}px)` : "none";
        el.style.setProperty("--ow-p", Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
      }

      this.rafId = settled ? null : requestAnimationFrame(this._boundRunFrame);
    }

    _applyTarget(value, snap, suppressChange) {
      const n = this.items.length;
      if (n === 0) return;

      let v = value;
      if (!this.opts.loop) {
        v = Math.min(Math.max(v, 0), Math.max(n - 1, 0));
      }
      if (snap) {
        v = Math.round(v);
      }
      this.target = v;

      const idx = ((Math.round(v) % n) + n) % n;
      if (idx !== this.selectedIndex) {
        this.selectedIndex = idx;
        this.itemEls.forEach((el, i) => {
          const isSelected = i === idx;
          el.classList.toggle("option-wheel__item--selected", isSelected);
          el.setAttribute("aria-selected", isSelected ? "true" : "false");
        });

        if (!suppressChange) {
          this._playTick();
          if (typeof this.opts.onChange === "function") {
            this.opts.onChange(idx, this.items[idx]);
          }
        }
      }

      this._startLoop();
    }

    _onWheel(e) {
      e.preventDefault();
      const rowH = this._getRowHeight();
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      const step = Math.max(-1, Math.min(1, delta / rowH));
      this._applyTarget(this.target + step, false);

      if (this.wheelTimer) clearTimeout(this.wheelTimer);
      this.wheelTimer = setTimeout(() => {
        this._applyTarget(this.target, true);
      }, 140);
    }

    _onPointerDown(e) {
      if (!this.opts.draggable) return;
      this.dragInfo = { y: e.clientY, start: this.target, id: e.pointerId };
      this.dragMoved = false;
      this.isDragging = true;
      this.root.classList.add("option-wheel--dragging");
    }

    _onPointerMove(e) {
      if (!this.dragInfo) return;
      const dy = e.clientY - this.dragInfo.y;
      if (!this.dragMoved && Math.abs(dy) > 4) {
        this.dragMoved = true;
        if (this.root.setPointerCapture) {
          try {
            this.root.setPointerCapture(this.dragInfo.id);
          } catch (err) {}
        }
      }
      if (this.dragMoved) {
        const rowH = this._getRowHeight();
        this._applyTarget(this.dragInfo.start - dy / rowH, false);
      }
    }

    _onPointerUp(e) {
      if (!this.dragInfo) return;
      if (this.root.releasePointerCapture && this.dragInfo.id != null) {
        try {
          this.root.releasePointerCapture(this.dragInfo.id);
        } catch (err) {}
      }
      this.dragInfo = null;
      this.isDragging = false;
      this.root.classList.remove("option-wheel--dragging");
      if (this.dragMoved) {
        this._applyTarget(this.target, true);
      }
    }

    _handleItemClick(index) {
      if (this.dragMoved) return;
      const n = this.items.length;
      if (n === 0) return;
      const cur = this.target;
      let d = index - (((cur % n) + n) % n);
      if (this.opts.loop && n > 1) {
        if (d > n / 2) d -= n;
        else if (d < -n / 2) d += n;
      }
      this._applyTarget(cur + d, true);
    }

    _onKeyDown(e) {
      let delta = null;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") delta = -1;
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") delta = 1;
      if (delta == null) return;
      e.preventDefault();
      this._applyTarget(Math.round(this.target) + delta, true);
    }

    // Public API
    selectIndex(index, snap = true) {
      this._applyTarget(index, snap);
    }

    getSelectedIndex() {
      return this.selectedIndex;
    }

    getSelectedItem() {
      return this.items[this.selectedIndex] || null;
    }

    setItems(items, defaultIndex = 0) {
      this.items = items || [];
      this.selectedIndex = Math.max(0, Math.min(defaultIndex, Math.max(this.items.length - 1, 0)));
      this.pos = this.selectedIndex;
      this.target = this.selectedIndex;
      this._renderItems();
      this._applyTarget(this.target, true, true);
    }

    updateConfig(newOpts = {}) {
      Object.assign(this.opts, newOpts);
      this._updateStyleProperties();
      this._applyTarget(this.target, true, true);
    }

    resize() {
      this._onResize();
    }

    destroy() {
      this.destroyed = true;
      if (this.rafId != null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.wheelTimer) {
        clearTimeout(this.wheelTimer);
        this.wheelTimer = null;
      }
      this._unbindEvents();
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
    }
  }

  return OptionWheel;
});
