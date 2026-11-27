// A dex string constant can be longer than a class file's 64 KB UTF-8 limit, which the
// JVM rejects outright ("Bad string initial value"). Such strings are split into chunks
// and rebuilt at class-initialisation time, the way TVBox's own dex fixer does it.
package dev.tvgo.spiderhost;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.FieldNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TypeInsnNode;

final class LongStrings {
    /** Comfortably below 65535 bytes even when every character costs three. */
    private static final int CHUNK = 20_000;
    /** A string this long cannot be a class constant. */
    private static final int LIMIT = 60_000;

    private LongStrings() {
    }

    /** Rewrites the too-long strings of one class; returns how many were found. */
    static int repair(ClassNode node) {
        List<FieldNode> fields = new ArrayList<>();
        List<String> values = new ArrayList<>();
        for (FieldNode field : node.fields) {
            if (!(field.value instanceof String value) || fits(value)) continue;
            if ((field.access & Opcodes.ACC_STATIC) == 0) continue;
            fields.add(field);
            values.add(value);
            field.value = null;
        }
        List<LdcInsnNode> constants = new ArrayList<>();
        List<String> constantValues = new ArrayList<>();
        for (MethodNode method : node.methods) {
            for (AbstractInsnNode instruction : method.instructions.toArray()) {
                if (!(instruction instanceof LdcInsnNode ldc)) continue;
                if (!(ldc.cst instanceof String value) || fits(value)) continue;
                constants.add(ldc);
                constantValues.add(value);
            }
        }
        if (fields.isEmpty() && constants.isEmpty()) return 0;

        if (!fields.isEmpty()) {
            MethodNode clinit = clinit(node);
            InsnList rebuild = new InsnList();
            for (int index = 0; index < fields.size(); index += 1) {
                rebuild.add(concat(values.get(index)));
                rebuild.add(new FieldInsnNode(Opcodes.PUTSTATIC, node.name, fields.get(index).name,
                        fields.get(index).desc));
            }
            clinit.instructions.insert(rebuild);
        }
        for (int index = 0; index < constants.size(); index += 1) {
            LdcInsnNode ldc = constants.get(index);
            MethodNode owner = methodOf(node, ldc);
            if (owner == null) continue;
            owner.instructions.insertBefore(ldc, concat(constantValues.get(index)));
            owner.instructions.remove(ldc);
        }
        return fields.size() + constants.size();
    }

    private static boolean fits(String value) {
        return value.getBytes(StandardCharsets.UTF_8).length < LIMIT;
    }

    /** `new StringBuilder().append(chunk)…toString()` */
    private static InsnList concat(String value) {
        InsnList code = new InsnList();
        code.add(new TypeInsnNode(Opcodes.NEW, "java/lang/StringBuilder"));
        code.add(new InsnNode(Opcodes.DUP));
        code.add(new MethodInsnNode(Opcodes.INVOKESPECIAL, "java/lang/StringBuilder", "<init>", "()V", false));
        for (int start = 0; start < value.length(); start += CHUNK) {
            int end = Math.min(value.length(), start + CHUNK);
            code.add(new LdcInsnNode(value.substring(start, end)));
            code.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "java/lang/StringBuilder", "append",
                    "(Ljava/lang/String;)Ljava/lang/StringBuilder;", false));
        }
        code.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "java/lang/StringBuilder", "toString",
                "()Ljava/lang/String;", false));
        return code;
    }

    private static MethodNode clinit(ClassNode node) {
        for (MethodNode method : node.methods) {
            if ("<clinit>".equals(method.name)) return method;
        }
        MethodNode created = new MethodNode(Opcodes.ACC_STATIC, "<clinit>", "()V", null, null);
        created.instructions.add(new InsnNode(Opcodes.RETURN));
        node.methods.add(created);
        return created;
    }

    private static MethodNode methodOf(ClassNode node, AbstractInsnNode instruction) {
        for (MethodNode method : node.methods) {
            if (method.instructions.contains(instruction)) return method;
        }
        return null;
    }
}
