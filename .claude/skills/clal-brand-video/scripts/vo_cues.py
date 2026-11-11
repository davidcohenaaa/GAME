# בונה פס קריינות אחד ורשימת cues (תזמון לכל משפט) מקטעי קריינות + קובצי טקסט.
# כל קטע: קובץ אודיו + קובץ טקסט עם ביטוי אחד בכל שורה (חלוקה לפי ההפסקות בדיבור).
# הסקריפט מזהה הפסקות (ffmpeg silencedetect), מתאים אותן לגבולות הביטויים, מאיץ לפי הצורך,
# ומחבר את הקטעים עם שקט ביניהם.
#
# שימוש:
#   python3 vo_cues.py --out-wav vo.wav --out-json cues.json [--tempo 1.05] [--lead .5] [--gap .6] [--tail 1.6] \
#       s1.mp3:s1.txt s2.mp3:s2.txt ...
# הפלט: cues.json = {"duration": T, "sections": [{start, end}], "cues": [{sec, i, text, start, end}]}
import argparse, json, re, subprocess, sys, tempfile, os

ap = argparse.ArgumentParser()
ap.add_argument('--out-wav', required=True)
ap.add_argument('--out-json', required=True)
ap.add_argument('--tempo', type=float, default=1.0, help='האצת הדיבור (1.0 = ללא; עד ~1.08 נשמע טבעי)')
ap.add_argument('--lead', type=float, default=0.5, help='שקט לפני הקטע הראשון')
ap.add_argument('--gap', type=float, default=0.6, help='שקט בין קטעים')
ap.add_argument('--tail', type=float, default=1.6, help='שקט אחרי הקטע האחרון')
ap.add_argument('--noise', default='-35dB')
ap.add_argument('--min-pause', type=float, default=0.25)
ap.add_argument('pairs', nargs='+', help='audio:text')
a = ap.parse_args()
SR = 44100


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def duration(f):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout)


def pauses(f):
    err = run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={a.noise}:d={a.min_pause}', '-f', 'null', '-']).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', err)]
    en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', err)]
    return list(zip(st, en))


tmp = tempfile.mkdtemp()
cues, sections, parts, t = [], [], [], a.lead
for si, pair in enumerate(a.pairs, 1):
    af, tf = pair.split(':')
    lines = [l.strip() for l in open(tf, encoding='utf-8') if l.strip()]
    D = duration(af)
    ps = [p for p in pauses(af) if 0.05 < p[0] < D - 0.05]
    # גבול צפוי לכל מעבר בין ביטויים לפי חלק יחסי מהתווים; בוחרים את ההפסקה הקרובה (לפי הסדר)
    chars = [len(l) for l in lines]
    total = sum(chars)
    bounds, used = [], -1
    for k in range(1, len(lines)):
        expect = D * sum(chars[:k]) / total
        cand = [(abs((p[0] + p[1]) / 2 - expect), j) for j, p in enumerate(ps) if j > used]
        if cand and len(ps) - used - 1 >= len(lines) - k:
            # מעדיפים לשמור מספיק הפסקות לגבולות שנותרו
            cand = [c for c in cand if c[1] <= len(ps) - (len(lines) - k)] or cand
            _, j = min(cand)
            bounds.append(ps[j]); used = j
        else:
            bounds.append((expect, expect))
    if len(ps) != len(lines) - 1:
        print(f'note: {af}: {len(ps)} pauses for {len(lines)} phrases – matched by text length; check cues', file=sys.stderr)
    starts = [0.0] + [b[1] for b in bounds]
    ends = [b[0] for b in bounds] + [D]
    sec_start = t
    for i, (s, e, txt) in enumerate(zip(starts, ends, lines)):
        cues.append({'sec': si, 'i': i, 'text': txt, 'start': round(t + s / a.tempo, 3), 'end': round(t + e / a.tempo, 3)})
    # האצה + המרה ל-WAV
    out = os.path.join(tmp, f'p{si}.wav')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', af, '-af', f'atempo={a.tempo}', '-ar', str(SR), '-ac', '1', out])
    d = duration(out)
    parts.append((out, t))
    t += d
    sections.append({'sec': si, 'start': round(sec_start, 3), 'end': round(t, 3)})
    t += a.gap
T = round(t - a.gap + a.tail, 3)

# מחברים: כל קטע ממוקם בזמן שלו על פס שקט באורך T
inputs, filt = [], []
for k, (f, start) in enumerate(parts):
    inputs += ['-i', f]
    filt.append(f'[{k}]adelay={int(start * 1000)}|{int(start * 1000)}[d{k}]')
mix = ''.join(f'[d{k}]' for k in range(len(parts)))
filt.append(f'{mix}amix=inputs={len(parts)}:normalize=0,apad=whole_dur={T}[out]')
r = run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[out]', '-t', str(T), '-ar', str(SR), a.out_wav])
if r.returncode:
    sys.exit(r.stderr)
json.dump({'duration': T, 'sections': sections, 'cues': cues}, open(a.out_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{a.out_wav}: {T}s, {len(cues)} cues in {len(sections)} sections -> {a.out_json}')
