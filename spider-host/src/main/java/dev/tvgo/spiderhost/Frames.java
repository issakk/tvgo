// dex -> JVM class conversion, with the stack-map frames the JVM's verifier demands.
//
// dex2jar 2.4 emits classes without StackMapTable, which Java 7+ rejects at link time
// ("Expecting a stackmap frame"), and sometimes collapses a `new-instance` to its
// supertype. Frames are recomputed with ASM and the collapsed allocations are recovered;
// a type whose hierarchy is missing from the payload degrades to Object instead of
// aborting the whole conversion.
package dev.tvgo.spiderhost;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.ClassNode;

final class Frames {
    private Frames() {
    }

    /** Rewrites every class of `source` into `target`, repairing allocation types and frames. */
    static void repair(Path source, Path target, ClassLoader host) throws IOException {
        Map<String, ClassNode> payload = readNodes(source);
        Map<String, ClassNode> hostNodes = new HashMap<>();
        ObjectNewRepair allocations = new ObjectNewRepair(internal -> node(internal, payload, hostNodes, host));
        SuperCalls superCalls = new SuperCalls(internal -> node(internal, payload, hostNodes, host));
        try (ZipFile zip = new ZipFile(source.toFile());
                ZipOutputStream out = new ZipOutputStream(Files.newOutputStream(target))) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.isDirectory()) continue;
                byte[] data;
                try (InputStream in = zip.getInputStream(entry)) {
                    data = in.readAllBytes();
                }
                if (entry.getName().endsWith(".class")) {
                    String name = entry.getName().substring(0, entry.getName().length() - ".class".length());
                    data = rewrite(name, data, payload, hostNodes, host, allocations, superCalls);
                }
                putEntry(out, entry.getName(), data);
            }
        }
    }

    private static byte[] rewrite(String name, byte[] data, Map<String, ClassNode> payload,
            Map<String, ClassNode> hostNodes, ClassLoader host, ObjectNewRepair allocations,
            SuperCalls superCalls) {
        try {
            ClassNode node = payload.get(name);
            if (node == null) return data;
            FieldValues.sanitize(node);
            InterfaceMethods.repair(node);
            superCalls.repair(node);
            allocations.repair(node);
            LongStrings.repair(node);
            ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_FRAMES) {
                @Override
                protected String getCommonSuperClass(String a, String b) {
                    return common(a, b, payload, hostNodes, host);
                }
            };
            node.accept(writer);
            return writer.toByteArray();
        } catch (Throwable unusable) {
            // A class ASM cannot rebuild keeps dex2jar's bytes: it fails only if it is used.
            return data;
        }
    }

    private static void putEntry(ZipOutputStream out, String name, byte[] data) throws IOException {
        out.putNextEntry(new ZipEntry(name));
        out.write(data);
        out.closeEntry();
    }

    private static String common(String a, String b, Map<String, ClassNode> payload,
            Map<String, ClassNode> hostNodes, ClassLoader host) {
        try {
            if (a.equals(b) || "java/lang/Object".equals(a)) return a;
            if (isAssignable(a, b, payload, hostNodes, host)) return a;
            if (isAssignable(b, a, payload, hostNodes, host)) return b;
            if (isInterface(a, payload, hostNodes, host) || isInterface(b, payload, hostNodes, host)) {
                return "java/lang/Object";
            }
            String superA = superOf(a, payload, hostNodes, host);
            while (superA != null) {
                if (isAssignable(superA, b, payload, hostNodes, host)) return superA;
                superA = superOf(superA, payload, hostNodes, host);
            }
            return "java/lang/Object";
        } catch (RuntimeException unknown) {
            return "java/lang/Object";
        }
    }

    private static boolean isAssignable(String target, String source, Map<String, ClassNode> payload,
            Map<String, ClassNode> hostNodes, ClassLoader host) {
        String current = source;
        while (current != null) {
            if (current.equals(target)) return true;
            ClassNode node = node(current, payload, hostNodes, host);
            if (node == null) return false;
            for (String itf : node.interfaces) if (itf.equals(target)) return true;
            current = node.superName;
        }
        return false;
    }

    private static boolean isInterface(String name, Map<String, ClassNode> payload,
            Map<String, ClassNode> hostNodes, ClassLoader host) {
        ClassNode node = node(name, payload, hostNodes, host);
        return node != null && (node.access & org.objectweb.asm.Opcodes.ACC_INTERFACE) != 0;
    }

    private static String superOf(String name, Map<String, ClassNode> payload,
            Map<String, ClassNode> hostNodes, ClassLoader host) {
        ClassNode node = node(name, payload, hostNodes, host);
        return node == null ? null : node.superName;
    }

    /** A payload class wins over the host's, as the payload's own loader does. */
    private static ClassNode node(String name, Map<String, ClassNode> payload,
            Map<String, ClassNode> hostNodes, ClassLoader host) {
        ClassNode own = payload.get(name);
        if (own != null) return own;
        if (hostNodes.containsKey(name)) return hostNodes.get(name);
        ClassNode node = null;
        try (InputStream in = host.getResourceAsStream(name + ".class")) {
            if (in != null) {
                node = new ClassNode();
                new ClassReader(in).accept(node, ClassReader.SKIP_CODE | ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
            }
        } catch (IOException unreadable) {
            node = null;
        }
        hostNodes.put(name, node);
        return node;
    }

    private static Map<String, ClassNode> readNodes(Path jar) throws IOException {
        Map<String, ClassNode> nodes = new HashMap<>();
        try (ZipFile zip = new ZipFile(jar.toFile())) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (!entry.getName().endsWith(".class")) continue;
                try (InputStream in = zip.getInputStream(entry)) {
                    ClassNode node = new ClassNode();
                    new ClassReader(in).accept(node, 0);
                    nodes.put(node.name, node);
                } catch (RuntimeException unreadable) {
                    // A class dex2jar emitted too damaged to read: leave it out of the hierarchy.
                }
            }
        }
        return nodes;
    }
}
