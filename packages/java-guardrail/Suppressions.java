import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Forbidden-suppression scan over added lines. */
record Suppressions(AddedLines added, Config cfg) {
    List<Violation> scan(String file) throws IOException {
        List<Violation> out = new ArrayList<>();
        added.of(file).forEach((no, text) -> {
            for (String p : cfg.suppressionPatterns()) {
                if (text.contains(p)) {
                    out.add(new Violation("FORBIDDEN_SUPPRESSION", file + ":" + no, null, 1, 0));
                }
            }
        });
        return out;
    }
}
