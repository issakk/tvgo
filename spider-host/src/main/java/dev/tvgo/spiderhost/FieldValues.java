// dex2jar sometimes attaches a field's ConstantValue to the wrong field: a HashMap field
// carrying the String constant of the field that followed it. The JVM rejects such a class
// outright ("Bad string initial value"), so a value whose type does not match its field's
// descriptor is dropped and the field keeps whatever <clinit> computes.
package dev.tvgo.spiderhost;

import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldNode;

final class FieldValues {
    private FieldValues() {
    }

    /** Drops the values that do not match their field's type; returns how many. */
    static int sanitize(ClassNode node) {
        int dropped = 0;
        for (FieldNode field : node.fields) {
            if (field.value == null) continue;
            if (matches(field.desc, field.value)) continue;
            field.value = null;
            dropped += 1;
        }
        return dropped;
    }

    private static boolean matches(String desc, Object value) {
        switch (desc) {
            case "Z":
            case "B":
            case "C":
            case "S":
            case "I":
                return value instanceof Integer;
            case "J":
                return value instanceof Long;
            case "F":
                return value instanceof Float;
            case "D":
                return value instanceof Double;
            case "Ljava/lang/String;":
                return value instanceof String;
            default:
                return false;
        }
    }
}
