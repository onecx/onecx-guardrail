import net.sourceforge.pmd.lang.java.ast.ASTExecutableDeclaration;
import net.sourceforge.pmd.lang.java.metrics.JavaMetrics;

/** Method-level measures: PMD metrics plus the custom nesting, switch and parameter rules. */
final class MethodMetrics {
    private final Sink sink;
    private final Thresholds t;
    private final int functionLimit;

    MethodMetrics(Sink sink, Thresholds t, int functionLimit) {
        this.sink = sink;
        this.t = t;
        this.functionLimit = functionLimit;
    }

    void record(ASTExecutableDeclaration m) {
        sink.symbol(Pmd.owner(m) + "." + m.getName());
        sink.add("FUNCTION_TOO_LONG", Pmd.num(JavaMetrics.NCSS, m), functionLimit);
        sink.add("CYCLOMATIC_COMPLEXITY", Pmd.num(JavaMetrics.CYCLO, m), t.maxCyclomatic());
        sink.add("COGNITIVE_COMPLEXITY", Pmd.num(JavaMetrics.COGNITIVE_COMPLEXITY, m), t.maxCognitive());
        sink.add("NESTING_TOO_DEEP", Shape.nesting(m), t.maxNesting());
        sink.add("SWITCH_TOO_MANY_CASES", Shape.switchCases(m), t.maxSwitchCases());
        boolean ctor = m.getXPathNodeName().equals("ConstructorDeclaration");
        sink.add("TOO_MANY_PARAMETERS", m.getArity(), ctor ? t.maxConstructorParameters() : t.maxParameters());
        sink.add("BOOLEAN_FLAG_PARAMETER", Shape.flags(m), 0);
    }
}
