import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Chooses the "before" state: nothing (--strict), a baseline file, or HEAD. */
record Previous(OnecxGuardrail o, Git git, Config cfg) {
    Baseline load(List<String> files) throws IOException {
        Path def = git.defaultBaseline();
        if (o.strict) {
            return Baseline.of(Map.of(), Set.of());
        }
        if (o.baseline != null || Files.exists(def)) {
            return Baseline.read(o.baseline != null ? o.baseline : def);
        }
        return new Head(git, cfg).load(files);
    }
}
