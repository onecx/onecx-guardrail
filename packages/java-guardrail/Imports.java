import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Package to imported names, read from the package/import declarations of source files. */
final class Imports {
    private static final Pattern DECL = Pattern.compile(
        "^\\s*(package|import)\\s+(?:static\\s+)?([\\w.]+?)(?:\\.\\*)?\\s*;", Pattern.MULTILINE);

    static Map<String, Set<String>> read(Path dir, List<String> files) throws IOException {
        Map<String, Set<String>> imports = new HashMap<>();
        for (String f : files) {
            Matcher m = DECL.matcher(Files.readString(dir.resolve(f), StandardCharsets.UTF_8));
            if (m.find() && m.group(1).equals("package")) {
                Set<String> names = imports.computeIfAbsent(m.group(2), k -> new TreeSet<>());
                while (m.find()) {
                    names.add(m.group(2));
                }
            }
        }
        return imports;
    }
}
