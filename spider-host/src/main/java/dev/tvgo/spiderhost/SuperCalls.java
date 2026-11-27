// dex2jar turns a dex `invoke-super` into an `invokespecial` whose owner is the *calling*
// class, so a spider that calls super.init(...) calls itself until the stack runs out.
// A real `invokespecial` on the class itself only happens for its own private methods, so
// a non-private, non-constructor target means "this was a super call": point it at the
// superclass that actually declares the method.
package dev.tvgo.spiderhost;

import java.util.function.Function;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;

final class SuperCalls {
    private final Function<String, ClassNode> types;

    SuperCalls(Function<String, ClassNode> types) {
        this.types = types;
    }

    /** Rewrites the self-referencing super calls of one class; returns how many. */
    int repair(ClassNode node) {
        int repaired = 0;
        for (MethodNode method : node.methods) {
            for (AbstractInsnNode instruction : method.instructions.toArray()) {
                if (!(instruction instanceof MethodInsnNode call)) continue;
                if (call.getOpcode() != Opcodes.INVOKESPECIAL) continue;
                if (!node.name.equals(call.owner)) continue;
                if ("<init>".equals(call.name)) continue;
                MethodNode target = find(node, call.name, call.desc);
                if (target != null && (target.access & Opcodes.ACC_PRIVATE) != 0) continue;
                String owner = declaringSuper(node.superName, call.name, call.desc);
                if (owner == null) continue;
                call.owner = owner;
                repaired += 1;
            }
        }
        return repaired;
    }

    private String declaringSuper(String start, String name, String desc) {
        String current = start;
        for (int depth = 0; current != null && depth < 32; depth += 1) {
            ClassNode node = types.apply(current);
            if (node == null) return null;
            if (find(node, name, desc) != null) return current;
            current = node.superName;
        }
        return null;
    }

    private static MethodNode find(ClassNode node, String name, String desc) {
        for (MethodNode method : node.methods) {
            if (method.name.equals(name) && method.desc.equals(desc)) return method;
        }
        return null;
    }
}
