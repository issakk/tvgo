# Third-party jars in `vendor/`

| jar | licence | use |
| --- | --- | --- |
| `dex-ir-v2.4.jar`, `dex-reader-v2.4.jar`, `dex-reader-api-v2.4.jar`, `dex-translator-v2.4.jar`, `dex-writer-v2.4.jar` | Apache-2.0 — [dex2jar](https://github.com/pxb1988/dex2jar) | dex → class files |
| `asm-9.8.jar`, `asm-tree-9.8.jar`, `asm-analysis-9.8.jar`, `asm-commons-9.8.jar`, `asm-util-9.8.jar` | BSD-3 — [ASM](https://asm.ow2.io/) | class rewriting and frame computation |
| `okhttp-3.12.1.jar`, `okio-1.17.5.jar` | Apache-2.0 — Square | the payloads' HTTP client |
| `gson-2.11.0.jar` | Apache-2.0 — Google | payload JSON binding |
| `jsoup-1.18.3.jar` | MIT — Jonathan Hedley | payload HTML parsing (where a payload does not bundle its own) |
| `android-json-0.0.20131108.vaadin1.jar` | Apache-2.0 — Android/Google | `org.json` with Android's `getString` semantics (numbers become strings) |
| `android-api.jar` | Apache-2.0 — Android SDK | signatures for the Android classes the host does not implement itself; the host's own classes in `src/main/java/android` take precedence |

`android-api.jar` is not committed: `build.sh` downloads it from Maven Central
(`com.google.android:android:4.1.1.4`) into `vendor/` when missing.
