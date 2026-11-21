import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.metrics.JavaMetrics;

/** File- and type-level measures: file NCSS, fan-out and god class. */
record TypeMetrics(Sink sink, Thresholds t) {
    void record(ASTCompilationUnit root) {
        int ncss = 0;
        for (ASTTypeDeclaration d : root.getTypeDeclarations()) {
            ncss += Pmd.num(JavaMetrics.NCSS, d);
        }
        sink.symbol("-");
        sink.add("FILE_TOO_LONG", ncss, t.maxFileLines());
        root.descendants(ASTTypeDeclaration.class).forEach(this::type);
    }

    private void type(ASTTypeDeclaration d) {
        sink.symbol(Pmd.owner(d));
        sink.add("FAN_OUT_TOO_HIGH", Pmd.num(JavaMetrics.FAN_OUT, d), t.maxFanOut());
        sink.add("GOD_CLASS", Pmd.isGodClass(d) ? 1 : 0, 0);
    }
}
