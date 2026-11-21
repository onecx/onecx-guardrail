import java.io.IOException;
import java.nio.file.Path;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.sourceforge.pmd.lang.document.TextDocument;

/** Computes all measures of Java files. */
final class Analyzer {
    private final Config cfg;
    private final PmdLanguage language = new PmdLanguage();

    Analyzer(Config cfg) {
        this.cfg = cfg;
    }

    Collection<Measure> analyze(Path dir, String rel) throws IOException {
        try (TextDocument doc = TextDocument.create(language.file(dir, rel))) {
            return new Collector(cfg, rel).collect(language.parse(doc));
        } catch (RuntimeException e) {
            return Skipped.warn(rel, e);
        }
    }

    /** Metric key to value for the given files below dir. */
    Map<String, Integer> metrics(Path dir, List<String> files) throws IOException {
        Map<String, Integer> out = new HashMap<>();
        for (String f : files) {
            for (Measure m : analyze(dir, f)) {
                out.put(m.key(), m.value());
            }
        }
        return out;
    }
}
