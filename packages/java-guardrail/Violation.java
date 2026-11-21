import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Map;
import java.util.stream.Collectors;

/** One reported finding; principle, why and fix come from the rules table. */
record Violation(String rule, String target, Integer before, int after, int limit) {
    /** Report order: by rule, then target. */
    static final Comparator<Violation> ORDER = Comparator.comparing(Violation::rule).thenComparing(Violation::target);

    private static final Map<String, String[]> RULES = Arrays.stream("""
FUNCTION_TOO_LONG|Small Functions / Single Responsibility|Long functions mix several reasons to change and are hard to read and test.|Extract cohesive blocks into well-named private functions; keep one level of abstraction per function.
FILE_TOO_LONG|Single Responsibility / High Cohesion|Large files collect unrelated responsibilities and cause merge conflicts.|Split by responsibility into separate modules/classes; move helpers next to their only user.
CYCLOMATIC_COMPLEXITY|Low Complexity|Many independent paths need many tests and hide bugs.|Replace branching with guard clauses, lookup maps/strategies or polymorphism; extract decisions into named predicates.
COGNITIVE_COMPLEXITY|Readability / Flat Control Flow|Nested and interrupted flow is hard to follow.|Use early returns, extract nested blocks, flatten loops with stream/array helpers.
NESTING_TOO_DEEP|Guard Clauses|Deep nesting hides the happy path.|Invert conditions and return/continue early; extract the inner block.
SWITCH_TOO_MANY_CASES|Open/Closed / Strategy|Large switches grow with every new variant and duplicate across the code.|Use a strategy map (`Record<Key, Handler>` / `Map`) or polymorphism.
TOO_MANY_PARAMETERS|Clean Function Signatures|Long parameter lists are easy to misorder and signal missing abstractions.|Introduce a typed options/parameter object grouping related values.
BOOLEAN_FLAG_PARAMETER|No Flag Arguments|A boolean parameter means the function does two things.|Split into two intention-revealing functions and let the caller choose.
FAN_OUT_TOO_HIGH|Low Coupling|Many collaborators make a unit fragile and hard to test.|Split the unit, introduce a facade, or depend on a narrower interface.
CIRCULAR_DEPENDENCY|Acyclic Dependencies Principle|Cycles prevent independent change, build and test.|Extract the shared part into a third module/package or invert one dependency via an interface.
GOD_CLASS|Single Responsibility|A class that knows and does too much attracts every change.|Split along responsibilities; move behaviour to the data it uses.
FORBIDDEN_SUPPRESSION|Fix, don't hide|Suppressions defeat the guardrail and let debt grow silently.|Remove the suppression comment and fix the underlying design problem.
""".split("\n")).map(l -> l.split("\\|")).collect(Collectors.toMap(a -> a[0], a -> a));

    @JsonProperty("principle")
    String principle() {
        return RULES.get(rule)[1];
    }

    @JsonProperty("why")
    String why() {
        return RULES.get(rule)[2];
    }

    @JsonProperty("fix")
    String fix() {
        return RULES.get(rule)[3];
    }

    String render(int no) {
        return String.format("%n%d. VIOLATION: %s%n   - Target: %s%n   - Metric: %s -> %d (allowed: <= %d)%n"
            + "   - Clean Code Principle: %s%n   - Why: %s%n   - Fix: %s%n", no, rule, target,
            before == null ? "new" : before, after, limit, principle(), why(), fix());
    }
}
