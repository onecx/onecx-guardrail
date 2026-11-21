import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/** The ratchet baseline; also the in-memory "previous state" (HEAD, baseline file or empty). */
record Baseline(int version, String runtime, Map<String, Integer> metrics, Map<String, Integer> files,
    Set<String> cycles, List<String> clones) {
    static Baseline of(Map<String, Integer> metrics, Set<String> cycles) {
        return new Baseline(1, "java", metrics, Map.of(), cycles, List.of());
    }

    static Baseline of(Facts facts) {
        Map<String, Integer> metrics = new TreeMap<>();
        Map<String, Integer> files = new TreeMap<>();
        for (Measure m : facts.measures()) {
            metrics.put(m.key(), m.value());
            if (m.rule().equals("FILE_TOO_LONG")) {
                files.put(m.file(), m.value());
            }
        }
        return new Baseline(1, "java", metrics, files, new TreeSet<>(facts.cycles()), List.of());
    }

    static Baseline read(Path file) throws IOException {
        Baseline b = Json.MAPPER.readValue(file.toFile(), Baseline.class);
        if (!"java".equals(b.runtime())) {
            throw new IllegalArgumentException("baseline " + file + " is not a java baseline (runtime != java)");
        }
        return b;
    }
}
