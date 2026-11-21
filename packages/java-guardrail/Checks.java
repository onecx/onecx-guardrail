import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Compares the facts with the previous state and returns the sorted violations. */
record Checks(OnecxGuardrail o, Git git, Config cfg) {
    List<Violation> run(Facts facts, Baseline prev) throws IOException {
        List<Violation> vs = new ArrayList<>();
        vs.addAll(MetricChecks.violations(facts, prev));
        vs.addAll(CycleChecks.newCycles(facts, prev));
        String base = o.strict ? null : o.staged ? "--cached" : "HEAD";
        Suppressions suppressions = new Suppressions(new AddedLines(git, git.root(), base), cfg);
        for (String f : facts.files()) {
            vs.addAll(suppressions.scan(f));
        }
        vs.sort(Violation.ORDER);
        return vs;
    }
}
