import java.util.ArrayList;
import java.util.List;

/** Reports package cycles that were not present before. */
final class CycleChecks {
    static List<Violation> newCycles(Facts facts, Baseline prev) {
        List<Violation> out = new ArrayList<>();
        for (String c : facts.cycles()) {
            String[] members = c.split("\\|");
            if (!prev.cycles().contains(c)) {
                out.add(new Violation("CIRCULAR_DEPENDENCY", String.join(" -> ", members) + " -> " + members[0], null, 1, 0));
            }
        }
        return out;
    }
}
