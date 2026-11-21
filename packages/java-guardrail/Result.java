import java.util.List;

/** The --format json document. */
record Result(String tool, String version, String runtime, boolean passed, List<Violation> violations) {}
