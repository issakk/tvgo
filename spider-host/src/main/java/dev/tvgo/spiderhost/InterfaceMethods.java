// An interface method in a class file must be public; dex2jar sometimes emits a
// non-public one, and the JVM refuses the whole interface ("has illegal modifiers").
// The body is never used for an interface, so only the flags need fixing.
package dev.tvgo.spiderhost;

import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.MethodNode;

final class InterfaceMethods {
    private InterfaceMethods() {
    }

    /** Makes the methods of an interface legal; returns how many were changed. */
    static int repair(ClassNode node) {
        if ((node.access & Opcodes.ACC_INTERFACE) == 0) return 0;
        int repaired = 0;
        for (MethodNode method : node.methods) {
            if (method.name.startsWith("<")) continue;
            int wanted = method.access | Opcodes.ACC_PUBLIC;
            wanted &= ~(Opcodes.ACC_PRIVATE | Opcodes.ACC_PROTECTED);
            wanted |= Opcodes.ACC_ABSTRACT;
            wanted &= ~(Opcodes.ACC_NATIVE | Opcodes.ACC_SYNCHRONIZED | Opcodes.ACC_FINAL);
            if (wanted == method.access) continue;
            method.access = wanted;
            method.instructions.clear();
            repaired += 1;
        }
        return repaired;
    }
}
