// The host runs on a JRE trimmed by jlink, so the modules it only reaches through a
// service loader can be missing at run time. Fail with the module's name instead of
// letting the app report a class-not-found halfway through a site.
package dev.tvgo.spiderhost;

import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;

final class Runtime {
    private Runtime() {
    }

    /** Names the modules this build needs but the JRE does not have; empty when it is whole. */
    static List<String> missing() {
        List<String> missing = new ArrayList<>();
        if (!present("java.net.http.HttpClient")) missing.add("java.net.http");
        if (!present("jdk.nio.zipfs.ZipFileSystemProvider")) missing.add("jdk.zipfs");
        try {
            if (!Charset.isSupported("GBK")) missing.add("jdk.charsets");
        } catch (RuntimeException unsupported) {
            missing.add("jdk.charsets");
        }
        return missing;
    }

    private static boolean present(String type) {
        try {
            Class.forName(type);
            return true;
        } catch (ClassNotFoundException | LinkageError absent) {
            return false;
        }
    }
}
