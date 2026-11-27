// Loads a configuration's spider jar: dex -> JVM classes (cached), then a class loader
// whose parent is the host, so the contract and Android stand-ins come from here.
package dev.tvgo.spiderhost;

import com.googlecode.d2j.dex.Dex2jar;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class Payloads {
    /** Bumped whenever the dex repairs change: an old conversion must not be reused. */
    private static final String REPAIR_VERSION = "1";
    private final Path cache;
    private final Map<String, ClassLoader> loaders = new ConcurrentHashMap<>();

    Payloads(Path cache) throws IOException {
        this.cache = cache;
        Files.createDirectories(cache);
    }

    /** The loader for `jar` (a path or an http(s) URL), converting it on first use. */
    ClassLoader loaderFor(String jar) throws IOException {
        return loaderFor(download(jar));
    }

    /** The jar as a local file: a URL is fetched once and kept under the host's data dir. */
    private File download(String jar) throws IOException {
        if (!jar.startsWith("http://") && !jar.startsWith("https://")) return new File(jar);
        Path jars = cache.resolveSibling("jars");
        Files.createDirectories(jars);
        Path target = jars.resolve(sha1(jar) + ".jar");
        if (Files.isRegularFile(target) && Files.size(target) > 0) return target.toFile();
        Path pending = Files.createTempFile(jars, "download-", ".jar");
        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .followRedirects(java.net.http.HttpClient.Redirect.ALWAYS)
                    .connectTimeout(java.time.Duration.ofSeconds(20))
                    .build();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder(java.net.URI.create(jar))
                    .timeout(java.time.Duration.ofSeconds(120))
                    .header("User-Agent", "TVGo/0.5 spider-host")
                    .GET()
                    .build();
            java.net.http.HttpResponse<byte[]> response =
                    client.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() / 100 != 2) {
                throw new IOException("下载 spider 失败：HTTP " + response.statusCode() + "（" + jar + "）");
            }
            Files.write(pending, response.body());
            Files.move(pending, target, StandardCopyOption.REPLACE_EXISTING);
            return target.toFile();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IOException("下载 spider 被中断（" + jar + "）");
        } finally {
            Files.deleteIfExists(pending);
        }
    }

    private ClassLoader loaderFor(File jar) throws IOException {
        String key = key(jar);
        ClassLoader existing = loaders.get(key);
        if (existing != null) return existing;
        synchronized (this) {
            existing = loaders.get(key);
            if (existing != null) return existing;
            Path converted = convert(jar, key);
            ClassLoader loader = new URLClassLoader(new URL[]{converted.toUri().toURL()},
                    Payloads.class.getClassLoader());
            loaders.put(key, loader);
            return loader;
        }
    }

    private Path convert(File jar, String key) throws IOException {
        Path out = cache.resolve(sha1(key) + ".jar");
        if (Files.isRegularFile(out)) return out;
        Path raw = Files.createTempFile(cache, "raw-", ".jar");
        Path repaired = Files.createTempFile(cache, "fixed-", ".jar");
        try {
            Dex2jar.from(jar).skipDebug().to(raw);
            Frames.repair(raw, repaired, Payloads.class.getClassLoader());
            Files.move(repaired, out, StandardCopyOption.REPLACE_EXISTING);
            return out;
        } finally {
            Files.deleteIfExists(raw);
            Files.deleteIfExists(repaired);
        }
    }

    private static String key(File jar) {
        return REPAIR_VERSION + ":" + jar.getAbsolutePath() + ":" + jar.length() + ":" + jar.lastModified();
    }

    private static String sha1(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte value : hash) out.append(String.format("%02x", value));
            return out.substring(0, 16);
        } catch (Exception noSha1) {
            return Integer.toHexString(input.hashCode());
        }
    }
}
