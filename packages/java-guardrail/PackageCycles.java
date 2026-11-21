import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/** Package cycles per module; keys are sorted member packages joined by '|' ("module:" prefix outside root). */
final class PackageCycles {
    static Set<String> find(Tree tree, Config cfg) throws IOException {
        Map<String, List<String>> modules = new TreeMap<>();
        for (String f : tree.java(cfg)) {
            if (cfg.isTest(f)) {
                continue;
            }
            modules.computeIfAbsent(tree.module(f), k -> new ArrayList<>()).add(f);
        }
        Set<String> out = new TreeSet<>();
        for (Map.Entry<String, List<String>> m : modules.entrySet()) {
            String prefix = m.getKey().isEmpty() ? "" : m.getKey() + ":";
            for (Set<String> comp : Scc.components(Imports.read(tree.dir(), m.getValue()))) {
                out.add(prefix + String.join("|", new TreeSet<>(comp)));
            }
        }
        return out;
    }
}
