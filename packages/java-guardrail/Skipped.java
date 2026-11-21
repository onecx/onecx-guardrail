import java.util.Collection;
import java.util.List;

/** A file that could not be parsed is reported on stderr and skipped instead of failing the run. */
final class Skipped {
    static Collection<Measure> warn(String rel, RuntimeException e) {
        String reason = String.valueOf(e.getMessage()).lines().findFirst().orElse("");
        System.err.println("onecx-guardrail: skipped " + rel + " (" + reason + ")");
        return List.of();
    }
}
