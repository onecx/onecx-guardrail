import java.util.ArrayList;
import java.util.List;

/** Reports measures that exceed their limit and grew compared with the previous state. */
final class MetricChecks {
    static List<Violation> violations(Facts facts, Baseline prev) {
        List<Violation> out = new ArrayList<>();
        for (Measure m : facts.measures()) {
            m.violation(prev.metrics().get(m.key())).ifPresent(out::add);
        }
        return out;
    }
}
