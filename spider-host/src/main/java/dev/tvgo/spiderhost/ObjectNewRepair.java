// dex2jar sometimes collapses a dex `new-instance` to its *supertype* — often all the
// way to java/lang/Object. The JVM then rejects the class ("Bad type on operand stack
// in putfield"), which takes whole sites down with it. A dex `new-instance` never names
// Object, so every `NEW java/lang/Object` here is that bug; the real type is the one the
// value is used as (a field's owner, a checkcast, a call's owner, the return type).
package dev.tvgo.spiderhost;

import java.util.HashMap;
import java.util.Map;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TypeInsnNode;

final class ObjectNewRepair {
    private final java.util.function.Function<String, ClassNode> types;
    private final Map<String, Boolean> constructible = new HashMap<>();

    ObjectNewRepair(java.util.function.Function<String, ClassNode> types) {
        this.types = types;
    }

    /** Rewrites the collapsed allocations of one class in place. */
    int repair(ClassNode owner) {
        int repaired = 0;
        for (MethodNode method : owner.methods) {
            for (AbstractInsnNode node : method.instructions.toArray()) {
                if (node.getOpcode() != Opcodes.NEW) continue;
                TypeInsnNode created = (TypeInsnNode) node;
                if (!"java/lang/Object".equals(created.desc)) continue;
                String real = infer(created, method);
                if (real == null) continue;
                created.desc = real;
                MethodInsnNode init = initCall(created, method);
                if (init != null) init.owner = real;
                repaired += 1;
            }
        }
        return repaired;
    }

    /** The type the value built by `created` is used as. */
    private String infer(TypeInsnNode created, MethodNode method) {
        AbstractInsnNode node = created;
        for (int step = 0; step < 16 && node != null; step += 1) {
            node = node.getNext();
            if (node == null) break;
            int opcode = node.getOpcode();
            if (opcode < 0) continue;
            if (node instanceof FieldInsnNode && opcode == Opcodes.PUTFIELD) {
                String owner = ((FieldInsnNode) node).owner;
                if (usable(owner)) return owner;
            }
            if (node instanceof TypeInsnNode && opcode == Opcodes.CHECKCAST) {
                String type = ((TypeInsnNode) node).desc;
                if (usable(type)) return type;
            }
            if (node instanceof MethodInsnNode) {
                MethodInsnNode call = (MethodInsnNode) node;
                if ("<init>".equals(call.name)) {
                    if ("java/lang/Object".equals(call.owner)) continue;
                    return null;
                }
                if (usable(call.owner)) return call.owner;
            }
            if (opcode >= Opcodes.IRETURN && opcode <= Opcodes.RETURN) {
                return memberType(method.desc);
            }
        }
        return null;
    }

    /** The `<init>` invoked on the value: NEW, DUP, INVOKESPECIAL "<init>". */
    private MethodInsnNode initCall(TypeInsnNode created, MethodNode method) {
        AbstractInsnNode node = created.getNext();
        while (node != null && node.getOpcode() < 0) node = node.getNext();
        if (node != null && node.getOpcode() == Opcodes.DUP) node = node.getNext();
        while (node != null && node.getOpcode() < 0) node = node.getNext();
        if (node instanceof MethodInsnNode) {
            MethodInsnNode call = (MethodInsnNode) node;
            if ("<init>".equals(call.name) && "()V".equals(call.desc)) return call;
        }
        return null;
    }

    /** An object type the host or the payload can build with a no-argument constructor. */
    private boolean usable(String internal) {
        if (internal == null || internal.startsWith("[")) return false;
        Boolean cached = constructible.get(internal);
        if (cached != null) return cached;
        boolean answer = buildable(types.apply(internal));
        constructible.put(internal, answer);
        return answer;
    }

    private static boolean buildable(ClassNode node) {
        if (node == null) return false;
        if ((node.access & (Opcodes.ACC_INTERFACE | Opcodes.ACC_ABSTRACT)) != 0) return false;
        for (MethodNode method : node.methods) {
            if ("<init>".equals(method.name) && "()V".equals(method.desc)) return true;
        }
        return false;
    }

    private static String memberType(String desc) {
        String result = desc.substring(desc.indexOf(')') + 1);
        if (!result.startsWith("L")) return null;
        String internal = result.substring(1, result.length() - 1);
        return internal;
    }
}
