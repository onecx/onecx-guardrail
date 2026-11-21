import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jgrapht.alg.connectivity.KosarajuStrongConnectivityInspector;
import org.jgrapht.graph.DefaultDirectedGraph;
import org.jgrapht.graph.DefaultEdge;

/** Strongly connected components (size > 1) of the package import graph, via JGraphT. */
final class Scc {
    static List<Set<String>> components(Map<String, Set<String>> imports) {
        DefaultDirectedGraph<String, DefaultEdge> g = new DefaultDirectedGraph<>(DefaultEdge.class);
        imports.keySet().forEach(g::addVertex);
        imports.forEach((pkg, names) -> names.forEach(n -> {
            String target = owning(n, imports.keySet());
            if (target != null && !target.equals(pkg)) {
                g.addEdge(pkg, target);
            }
        }));
        List<Set<String>> out = new KosarajuStrongConnectivityInspector<>(g).stronglyConnectedSets();
        out.removeIf(s -> s.size() < 2);
        return out;
    }

    /** Longest package prefix of an imported name that belongs to the analysed source set. */
    private static String owning(String name, Set<String> packages) {
        for (String n = name; n.contains("."); n = n.substring(0, n.lastIndexOf('.'))) {
            String pkg = n.substring(0, n.lastIndexOf('.'));
            if (packages.contains(pkg)) {
                return pkg;
            }
        }
        return null;
    }
}
