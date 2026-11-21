import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.core.util.Separators;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Writes the baseline deterministically: sorted keys, 2-space indent, trailing newline. */
final class BaselineWriter {
    static void write(Baseline baseline, Path file) throws IOException {
        DefaultIndenter indent = new DefaultIndenter("  ", "\n");
        DefaultPrettyPrinter pp = new DefaultPrettyPrinter()
            .withSeparators(Separators.createDefaultInstance().withObjectFieldValueSpacing(Separators.Spacing.AFTER));
        pp.indentObjectsWith(indent);
        pp.indentArraysWith(indent);
        String text = Json.MAPPER.writer(pp).writeValueAsString(baseline);
        Files.writeString(file, text.replace("[ ]", "[]").replace("{ }", "{}") + "\n");
    }
}
