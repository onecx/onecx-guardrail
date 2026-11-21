import net.sourceforge.pmd.lang.LanguageProcessor;
import net.sourceforge.pmd.lang.LanguageProcessorRegistry;
import net.sourceforge.pmd.lang.ast.Parser.ParserTask;
import net.sourceforge.pmd.lang.ast.SemanticErrorReporter;
import net.sourceforge.pmd.lang.document.TextDocument;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;

/** Runs PMD's parser for one document. */
final class PmdParse {
    static ASTCompilationUnit parse(LanguageProcessor processor, LanguageProcessorRegistry registry, TextDocument doc) {
        ParserTask task = new ParserTask(doc, SemanticErrorReporter.noop(), registry);
        return (ASTCompilationUnit) processor.services().getParser().parse(task);
    }
}
