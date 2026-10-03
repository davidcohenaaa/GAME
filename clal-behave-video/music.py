# מוזיקת רקע מקורית, 120BPM, מסונכרנת לחיתוכים (כל פעמה = 0.5 שנ׳)
import numpy as np, wave
SR, BPM, DUR = 44100, 120, 23.5
beat = 60 / BPM
n = int(SR * DUR); out = np.zeros(n)
t_ = lambda d: np.arange(int(SR * d)) / SR
def add(sig, at, g=1.0):
    i = int(at * SR); j = min(n, i + len(sig)); out[i:j] += g * sig[:j - i]
def kick():
    t = t_(.35); f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def hat():
    t = t_(.06); x = np.random.randn(len(t)); x = np.diff(x, prepend=0)
    return x * np.exp(-t * 70) * .5
def clap():
    t = t_(.18); return np.random.randn(len(t)) * np.exp(-t * 25) * .6
def tone(f, d, kind='saw'):
    t = t_(d); ph = (f * t) % 1
    w = (2 * ph - 1) if kind == 'saw' else np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / .01) * np.exp(-t * 3)
    return w * env
def pad(fs, d):
    t = t_(d); s = sum(np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) for f in fs) / len(fs)
    return s * np.minimum(1, t / .3) * np.minimum(1, (d - t) / .3)
# אקורדים: Am F C G (שני תיבות כל אחד = 4 שנ׳)
chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
roots = [110, 87.3, 130.8, 98]
nb = int(DUR / beat)
for b in range(nb):
    at = b * beat
    end = at >= 20.0  # סיום: רק פד
    if not end:
        add(kick(), at, .9)
        add(hat(), at + beat / 2, .35)
        if b % 2 == 1: add(clap(), at, .25)
        r = roots[(b // 8) % 4]
        add(tone(r, beat * .9), at, .22)
        add(tone(r * 2, beat * .4), at + beat / 2, .1)
    if b % 8 == 0:
        add(pad([f for f in chords[(b // 8) % 4]], min(4, DUR - at)), at, .18)
# אקורד סיום + פעמון
add(pad([220, 277.2, 329.6, 440], 3.5), 20.0, .3)
for k, f in enumerate([880, 1108.7, 1318.5]):
    add(tone(f, 1.5, 'sine') * .6, 20.0 + k * .12, .25)
# פייד-אאוט
fade = int(SR * 1.2); out[-fade:] *= np.linspace(1, 0, fade)
out /= np.max(np.abs(out)) * 1.1
pcm = (out * 32767).astype(np.int16)
with wave.open('music.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
