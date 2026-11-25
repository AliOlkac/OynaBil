#!/usr/bin/env bash
# Penaltı ve Basketbol oyunlarının spiker, tribün ve top seslerini siteye uygun hâle getirir.
#
# Kaynak sesler ElevenLabs ile üretilir (docs/SESLER.md) ve ayrı bir depoda durur. Bu betik onları
# tek kanala indirir, baştaki ve sondaki sessizliği kırpar, ses düzeyini eşitler ve küçük birer mp3
# olarak public/ses/penalti/ altına yazar. Site bu dosyaları çevrimdışı çalışmak için önbelleğe alır.
#
# Kullanım: scripts/sesleri-hazirla.sh <ses deposunun klasörü>
#   Beklenen içerik: jobs/oynabil-penalti-spiker-raju/*.mp3, jobs/oynabil-basket-spiker/*.mp3 ve sfx/oynabil-*.mp3
set -euo pipefail

SRC="${1:?Kullanım: scripts/sesleri-hazirla.sh <ses deposunun klasörü>}"
OUT="public/ses/penalti"
mkdir -p "$OUT"

# Tepe düzeyi hedefe çekilir (dB); kısa seslerde "loudnorm" güvenilir değildir.
peak_gain() {
  local file="$1" target="$2" max
  max=$(ffmpeg -hide_banner -nostats -i "$file" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-\{0,1\}[0-9.]*\) dB.*/\1/p')
  awk -v m="$max" -v t="$target" 'BEGIN { printf "%.2f", t - m }'
}

TRIM="silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,areverse"

encode() {
  local in="$1" out="$2" target="$3" extra="${4:-}" gain
  gain=$(peak_gain "$in" "$target")
  ffmpeg -hide_banner -loglevel error -y -i "$in" -ac 1 -ar 44100 -af "${TRIM},volume=${gain}dB${extra}" -codec:a libmp3lame -b:a 64k "$out"
}

# Spiker replikleri
for f in "$SRC"/jobs/oynabil-penalti-spiker-raju/*.mp3; do
  encode "$f" "$OUT/spiker-$(basename "$f")" -1.5
done

# Stadyum ve vuruş sesleri. Tribün sesleri replikleri bastırmasın diye daha alçaktır.
encode "$SRC/sfx/oynabil-tribun-ortam.mp3" "$OUT/tribun-ortam.mp3" -9
encode "$SRC/sfx/oynabil-tribun-gol.mp3" "$OUT/tribun-gol.mp3" -3 ",afade=t=out:st=5:d=1"
encode "$SRC/sfx/oynabil-tribun-ah.mp3" "$OUT/tribun-ah.mp3" -5 ",afade=t=out:st=2.8:d=0.7"
encode "$SRC/sfx/oynabil-tribun-alkis.mp3" "$OUT/tribun-alkis.mp3" -5 ",afade=t=out:st=3.2:d=0.8"
encode "$SRC/sfx/oynabil-duduk.mp3" "$OUT/duduk.mp3" -6
encode "$SRC/sfx/oynabil-vurus.mp3" "$OUT/vurus.mp3" -2
encode "$SRC/sfx/oynabil-ag.mp3" "$OUT/ag.mp3" -3
encode "$SRC/sfx/oynabil-direk.mp3" "$OUT/direk.mp3" -3
encode "$SRC/sfx/oynabil-eldiven.mp3" "$OUT/eldiven.mp3" -2

du -ch "$OUT"/*.mp3 | tail -1

# Basketbol: spiker, salon ve top sesleri
OUT="public/ses/basketbol"
mkdir -p "$OUT"
for f in "$SRC"/jobs/oynabil-basket-spiker/*.mp3; do
  encode "$f" "$OUT/spiker-$(basename "$f")" -1.5
done
encode "$SRC/sfx/oynabil-salon-ortam.mp3" "$OUT/salon-ortam.mp3" -10
encode "$SRC/sfx/oynabil-salon-cosku.mp3" "$OUT/salon-cosku.mp3" -3 ",afade=t=out:st=3.2:d=0.8"
encode "$SRC/sfx/oynabil-salon-ah.mp3" "$OUT/salon-ah.mp3" -5 ",afade=t=out:st=1.9:d=0.6"
encode "$SRC/sfx/oynabil-basket-file.mp3" "$OUT/file.mp3" -3
encode "$SRC/sfx/oynabil-basket-cember.mp3" "$OUT/cember.mp3" -3
encode "$SRC/sfx/oynabil-basket-panya.mp3" "$OUT/panya.mp3" -3
encode "$SRC/sfx/oynabil-basket-sekme.mp3" "$OUT/sekme.mp3" -4
encode "$SRC/sfx/oynabil-basket-buzzer.mp3" "$OUT/buzzer.mp3" -6
du -ch "$OUT"/*.mp3 | tail -1
