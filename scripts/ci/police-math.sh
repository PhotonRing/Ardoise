#!/bin/sh
# Police mathématique (table MATH) des workflows CI et Release : sans elle, Chromium n'étire pas les délimiteurs
# (\left( des bancs formules-office et formules) et npm run check échoue. Noto Sans Math 3.000, celle d'Arch :
# celle d'Ubuntu (fonts-noto-core) est plus ancienne et n'étire pas non plus. Un seul script pour les deux workflows.
set -eu
curl -sSL -o /tmp/math.zip https://github.com/notofonts/math/releases/download/NotoSansMath-v3.000/NotoSansMath-v3.000.zip
echo "ac351837b41f8a897f020b97fb0f075ad574c1e9669fb5839ada1f92fd748356  /tmp/math.zip" | sha256sum -c -
mkdir -p ~/.local/share/fonts
unzip -j -o /tmp/math.zip 'NotoSansMath/hinted/ttf/NotoSansMath-Regular.ttf' -d ~/.local/share/fonts
fc-cache -f ~/.local/share/fonts
fc-list | grep -i 'sans math'
