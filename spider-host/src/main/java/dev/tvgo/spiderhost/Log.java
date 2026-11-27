// The host's log: everything it and its payloads print is also appended to
// <data>/spider-host.log, because the normal way to start it (a login item with javaw.exe)
// has no console to read. Rotates at 4 MB so it cannot grow without bound.
package dev.tvgo.spiderhost;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

final class Log {
    private static final long ROTATE_BYTES = 4L * 1024 * 1024;
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static Path file;

    private Log() {
    }

    /** Starts writing to `data/spider-host.log`; the console keeps working too. */
    static void open(Path data) throws IOException {
        Files.createDirectories(data);
        file = data.resolve("spider-host.log");
        if (Files.isRegularFile(file) && Files.size(file) > ROTATE_BYTES) {
            Files.move(file, data.resolve("spider-host.log.1"), StandardCopyOption.REPLACE_EXISTING);
        }
        PrintStream sink = new PrintStream(Files.newOutputStream(file, java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND), true, StandardCharsets.UTF_8);
        System.setOut(tee(System.out, sink));
        System.setErr(tee(System.err, sink));
        note("host 启动：" + System.getProperty("java.version") + " / " + System.getProperty("os.name"));
    }

    static Path file() {
        return file;
    }

    /** A timestamped line of the host's own (the payloads' output is copied as it comes). */
    static void note(String message) {
        System.out.println("[" + LocalDateTime.now().format(STAMP) + "] " + message);
    }

    /** The last `lines` lines of the log, for the app's diagnostics view. */
    static String tail(int lines) {
        if (file == null || !Files.isRegularFile(file)) return "（还没有日志）";
        try {
            List<String> all = Files.readAllLines(file, StandardCharsets.UTF_8);
            int from = Math.max(0, all.size() - Math.max(1, lines));
            return String.join("\n", all.subList(from, all.size()));
        } catch (IOException unreadable) {
            return "（读不了日志：" + unreadable.getMessage() + "）";
        }
    }

    private static PrintStream tee(PrintStream console, PrintStream sink) {
        OutputStream both = new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                console.write(b);
                sink.write(b);
            }

            @Override
            public void write(byte[] bytes, int offset, int length) throws IOException {
                console.write(bytes, offset, length);
                sink.write(bytes, offset, length);
            }

            @Override
            public void flush() throws IOException {
                console.flush();
                sink.flush();
            }
        };
        return new PrintStream(both, true, StandardCharsets.UTF_8);
    }
}
