import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Added lines of a file: the whole file when new or when diffBase is null, else the "+" lines of the diff. */
record AddedLines(Git git, Path root, String diffBase) {
    private static final Pattern HUNK = Pattern.compile("^@@ .*\\+(\\d+)");

    Map<Integer, String> of(String file) throws IOException {
        Map<Integer, String> out = new TreeMap<>();
        if (diffBase == null || git.tryRun("cat-file", "-e", "HEAD:" + file).isEmpty()) {
            List<String> lines = Files.readAllLines(root.resolve(file), StandardCharsets.UTF_8);
            for (int i = 0; i < lines.size(); i++) {
                out.put(i + 1, lines.get(i));
            }
            return out;
        }
        int line = 0;
        for (String l : git.run("diff", diffBase, "-U0", "--", file).split("\n")) {
            Matcher h = HUNK.matcher(l);
            if (h.find()) {
                line = Integer.parseInt(h.group(1));
            } else if (line > 0 && l.startsWith("+")) {
                out.put(line++, l.substring(1));
            }
        }
        return out;
    }
}
