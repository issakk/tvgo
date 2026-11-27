#!/usr/bin/env bash
# Builds build/spider-host.jar from src/. The vendored jars stay separate (they are on the
# host's classpath, see start.cmd), which keeps their licences and versions visible.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

ANDROID_API_JAR="$HERE/vendor/android-api.jar"
ANDROID_API_URL="https://repo1.maven.org/maven2/com/google/android/android/4.1.1.4/android-4.1.1.4.jar"
if [ ! -f "$ANDROID_API_JAR" ]; then
  echo "downloading $ANDROID_API_JAR"
  curl -sSL --max-time 300 -o "$ANDROID_API_JAR" "$ANDROID_API_URL"
fi

OUT="$HERE/build"
CLS="$OUT/classes"
CP=$(ls "$HERE"/vendor/*.jar | tr '\n' ':')

rm -rf "$CLS"
mkdir -p "$CLS"
find "$HERE/src/main/java" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -encoding UTF-8 -cp "$CP" -d "$CLS" @"$OUT/sources.txt"
jar --create --file "$OUT/spider-host.jar" --main-class dev.tvgo.spiderhost.Main -C "$CLS" .
echo "built $OUT/spider-host.jar"
