import java.util.Collection;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTExecutableDeclaration;

/** Walks a parsed file and records file-, type- and method-level measures. */
final class Collector {
    private final Sink sink;
    private final MethodMetrics methods;
    private final TypeMetrics types;

    Collector(Config cfg, String rel) {
        Thresholds t = cfg.thresholds();
        this.sink = new Sink(rel);
        this.methods = new MethodMetrics(sink, t, cfg.isTest(rel) ? t.maxTestFunctionLines() : t.maxFunctionLines());
        this.types = new TypeMetrics(sink, t);
    }

    Collection<Measure> collect(ASTCompilationUnit root) {
        root.descendants(ASTExecutableDeclaration.class).forEach(methods::record);
        types.record(root);
        return sink.measures();
    }
}
