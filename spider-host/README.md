# spider-host

The desktop side of TVGo's CatVod Spider support: a small JVM program that turns a
configuration's `spider.jar` (a `classes.dex` payload written for Android) into runnable
classes and answers the app's requests over stdin/stdout.

```text
TVGo (TS)  --HTTP POST /rpc, one JSON per request-->  spider-host (JVM)  -->  payload spiders
```

The app cannot start the host itself (its runtime gives it no path to files it ships), so the host is
started by the user (`start.cmd`) or at login, and the app only connects to it. The address is a setting.

## Protocol

Every request is one line; every response is one line. The host prints `{"ready":true}`
first, then one response per request, in completion order.

```jsonc
// request
{"id": 7, "op": "home", "jar": "C:/…/spider.jar", "api": "csp_Douban", "ext": "", "siteKey": "豆瓣"}
// response
{"id": 7, "ok": true, "result": "{\"class\":[…],\"list\":[…]}"}
{"id": 7, "ok": false, "error": "VerifyError: …"}
```

| op | extra fields | payload call |
| --- | --- | --- |
| `ping` / `info` | — | — |
| `home` | `filter?` (default true) | `homeContent(boolean)` |
| `video` | — | `homeVideoContent()` |
| `category` | `tid`, `pg`, `filter?`, `extend?` | `categoryContent(tid, pg, filter, extend)` |
| `detail` | `ids[]` or `id` | `detailContent(List<String>)` |
| `search` | `key`, `quick?`, `pg?` | `searchContent(key, quick[, pg])` |
| `player` | `flag`, `vid`, `vip[]` | `playerContent(flag, vid, vip)` |
| `live` | `url` | `liveContent(url)` |
| `proxy` | `params{}` | `proxy(Map)` |

`jar`, `api` and `ext` are sent with every request; the host keeps one initialised spider
per `(jar, api, ext)` and runs at most four requests at a time.

## What it does to the payload

TVBox loads a `classes.dex` into Android's Dalvik. A desktop JVM has no Dalvik, so the host
converts the dex with [dex2jar](https://github.com/pxb1988/dex2jar) and repairs what the
conversion gets wrong:

| repair | why |
| --- | --- |
| recompute stack-map frames (ASM `COMPUTE_FRAMES`) | dex2jar emits none; Java 7+ rejects the class at link time |
| recover collapsed `new-instance` types | d2j sometimes allocates the *supertype*, and `putfield`/`invoke` then fail verification |
| rewrite self-owned `invokespecial` | d2j turns dex `invoke-super` into a call on itself, so `super.init(…)` recurses forever |
| make interface methods public | d2j emits non-public interface methods, which the JVM refuses |
| move over-long string constants into `<clinit>` | a class constant is capped at 64 KB UTF-8 |
| drop `ConstantValue`s of the wrong type | d2j attaches a field's constant to its neighbour |
| `com.github.catvod.*` contract + Android stand-ins | the payload expects the host app to provide `Spider`, `OkHttp`, `Init`, `TextUtils`, `Uri`, `Handler`, … |

The converted jar is cached under the app's data directory, keyed by jar path, size,
mtime and `Payloads.REPAIR_VERSION`.

## Layout

```text
src/main/java/android/**                    Android stand-ins the payload calls
src/main/java/com/github/catvod/**          the CatVod spider contract
src/main/java/dev/tvgo/spiderhost/**        the host: RPC loop, HTTP server, dex conversion, repairs
vendor/*.jar                                third-party jars (see LICENSE.md)
start.cmd                                   starts the host on port 29123 (packaged layout)
build.sh / build.ps1                        javac + jar
```

## Building

```bash
./build.sh          # -> build/spider-host.jar; needs a JDK 17+
```

At runtime the host needs the vendored jars on its classpath (ours first, so the Android stand-ins win):

```bash
java -cp "build/spider-host.jar:vendor/*" dev.tvgo.spiderhost.Main --serve 29123
```

## Debugging a payload

```bash
java -Dtvgo.spider.log=true -Dtvgo.spider.trace=true \
     -Dtvgo.spider.data=/tmp/spider-data \
     -cp "build/spider-host.jar:vendor/*" dev.tvgo.spiderhost.Main
```

`tvgo.spider.log` turns on the payload's own logging (and `SpiderDebug`), `tvgo.spider.trace`
prints the stack of every failed request.

## Licence

`vendor/` holds third-party jars under their own licences (Apache-2.0: dex2jar, ASM,
OkHttp, Gson, Android SDK API jar; MIT: jsoup; JSON licence: org.json). `vendor/LICENSE.md`
lists them. The host's own code follows the app's licence.
