import java.util.ArrayDeque;
import java.util.Deque;
import net.sourceforge.pmd.lang.ast.Node;
import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.ast.JavaNode;
import net.sourceforge.pmd.lang.java.metrics.JavaMetrics;
import net.sourceforge.pmd.lang.metrics.Metric;
import net.sourceforge.pmd.lang.metrics.MetricsUtil;

/** Direct uses of PMD's metrics API. */
final class Pmd {
    static <N extends Node, R extends Number> int num(Metric<? super N, R> metric, N node) {
        R value = metric.supports(node) ? MetricsUtil.computeMetric(metric, node) : null;
        return value == null ? 0 : value.intValue();
    }

    /** Same thresholds as PMD's GodClass rule (WMC >= 47, ATFD > 5, TCC < 1/3). */
    static boolean isGodClass(ASTTypeDeclaration d) {
        if (!MetricsUtil.supportsAll(d, JavaMetrics.TIGHT_CLASS_COHESION)) {
            return false;
        }
        double tcc = MetricsUtil.computeMetric(JavaMetrics.TIGHT_CLASS_COHESION, d);
        return num(JavaMetrics.WEIGHED_METHOD_COUNT, d) >= 47 && num(JavaMetrics.ACCESS_TO_FOREIGN_DATA, d) > 5
            && tcc < 1.0 / 3;
    }

    static String owner(JavaNode node) {
        Deque<String> names = new ArrayDeque<>();
        for (JavaNode n : node.ancestorsOrSelf().filterIs(ASTTypeDeclaration.class)) {
            names.addFirst(((ASTTypeDeclaration) n).getSimpleName());
        }
        return String.join(".", names);
    }
}
