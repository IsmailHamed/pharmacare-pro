const SOUND_PREF_STORAGE_KEY = "PHARMACARE_POS_SOUND_ENABLED_V1";

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * خدمة التغذية الراجعة الصوتية لنقطة البيع (Offline Web Audio Synthesizer)
 * تولّد نغمات فورية مميزة بدون أي ملفات صوتية خارجية ولا تعطّل عملية البيع عند غياب بطاقة الصوت
 */
export class SoundFeedbackService {
  private static audioCtx: AudioContext | null = null;
  private static enabled: boolean = SoundFeedbackService.loadPreference();

  private static loadPreference(): boolean {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(SOUND_PREF_STORAGE_KEY);
        if (stored !== null) {
          return stored === "true";
        }
      }
    } catch {
      // تجاهل أخطاء التخزين والعودة للتفعيل الافتراضي
    }
    return true;
  }

  static isEnabled(): boolean {
    return SoundFeedbackService.enabled;
  }

  static setEnabled(value: boolean): boolean {
    SoundFeedbackService.enabled = value;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(SOUND_PREF_STORAGE_KEY, String(value));
      }
    } catch {
      // تجاهل أخطاء التخزين
    }
    if (value) {
      SoundFeedbackService.playPackAdd();
    }
    return SoundFeedbackService.enabled;
  }

  static toggle(): boolean {
    return SoundFeedbackService.setEnabled(!SoundFeedbackService.enabled);
  }

  private static getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!SoundFeedbackService.audioCtx) {
        const AudioCtx =
          window.AudioContext ||
          (window as WindowWithWebkitAudio).webkitAudioContext;
        if (!AudioCtx) return null;
        SoundFeedbackService.audioCtx = new AudioCtx();
      }
      if (SoundFeedbackService.audioCtx.state === "suspended") {
        void SoundFeedbackService.audioCtx.resume();
      }
      return SoundFeedbackService.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * توليد نبضة صوتية مضبوطة الغلاف (Envelope) لمنع صوت الطقطقة في السماعات
   */
  private static scheduleTone(
    ctx: AudioContext,
    frequency: number,
    startOffsetSec: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const startTime = ctx.currentTime + startOffsetSec;
    const endTime = startTime + durationSec;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(endTime + 0.01);
  }

  /**
   * نغمة إضافة علبة كاملة للسلة (Beep قياسي واضح وسريع)
   */
  static playPackAdd(): void {
    if (!SoundFeedbackService.enabled) return;
    const ctx = SoundFeedbackService.getContext();
    if (!ctx) return;

    SoundFeedbackService.scheduleTone(ctx, 1100, 0, 0.085, "sine", 0.16);
  }

  /**
   * نغمة مميزة للبيع بالشريط الفرط (نغمتان متصاعدتان حادتان للتمييز الفوري عن العلبة)
   */
  static playStripAdd(): void {
    if (!SoundFeedbackService.enabled) return;
    const ctx = SoundFeedbackService.getContext();
    if (!ctx) return;

    SoundFeedbackService.scheduleTone(ctx, 1480, 0, 0.065, "triangle", 0.17);
    SoundFeedbackService.scheduleTone(ctx, 1860, 0.075, 0.08, "triangle", 0.17);
  }

  /**
   * نغمة إتمام الفاتورة والبيع بنجاح (نغمة ثلاثية تصاعدية مريحة)
   */
  static playCheckoutSuccess(): void {
    if (!SoundFeedbackService.enabled) return;
    const ctx = SoundFeedbackService.getContext();
    if (!ctx) return;

    SoundFeedbackService.scheduleTone(ctx, 587.33, 0, 0.09, "sine", 0.15); // D5
    SoundFeedbackService.scheduleTone(ctx, 739.99, 0.08, 0.09, "sine", 0.15); // F#5
    SoundFeedbackService.scheduleTone(ctx, 880.0, 0.16, 0.16, "sine", 0.17); // A5
  }

  /**
   * نغمة تحذيرية (Buzzer) للدواء منتهي الصلاحية، الباركود غير الموجود، نفاد الرصيد، أو التداخل الدوائي
   */
  static playWarningBuzzer(): void {
    if (!SoundFeedbackService.enabled) return;
    const ctx = SoundFeedbackService.getContext();
    if (!ctx) return;

    SoundFeedbackService.scheduleTone(ctx, 210, 0, 0.13, "sawtooth", 0.18);
    SoundFeedbackService.scheduleTone(ctx, 165, 0.15, 0.22, "sawtooth", 0.2);
  }
}
