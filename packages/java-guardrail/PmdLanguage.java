import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import net.sourceforge.pmd.lang.LanguageProcessor;
import net.sourceforge.pmd.lang.LanguageProcessorRegistry;
import net.sourceforge.pmd.lang.LanguageVersion;
import net.sourceforge.pmd.lang.document.TextDocument;
import net.sourceforge.pmd.lang.document.TextFile;
import net.sourceforge.pmd.lang.java.JavaLanguageModule;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;

/** PMD's Java language module: reads and parses sources. */
final class PmdLanguage {
    private final LanguageProcessor processor;
    private final LanguageProcessorRegistry registry;
    private final LanguageVersion version;

    PmdLanguage() {
        JavaLanguageModule lang = JavaLanguageModule.getInstance();
        this.processor = lang.createProcessor(lang.newPropertyBundle());
        this.registry = LanguageProcessorRegistry.singleton(processor);
        this.version = lang.getLatestVersion();
    }

    TextFile file(Path dir, String rel) {
        return TextFile.forPath(dir.resolve(rel), StandardCharsets.UTF_8, version);
    }

    ASTCompilationUnit parse(TextDocument doc) {
        return PmdParse.parse(processor, registry, doc);
    }
}
