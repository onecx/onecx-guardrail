import java.util.Optional;

/** A computed metric value with its limit. */
record Measure(String rule, String file, String symbol, int value, int limit) {
    String key() {
        return rule + "|" + file + "|" + symbol;
    }

    /** A violation iff over the limit and (new or grown); before == null means new. */
    Optional<Violation> violation(Integer before) {
        String target = symbol.equals("-") ? file : file + " :: " + symbol;
        return value > limit && (before == null || value > before)
            ? Optional.of(new Violation(rule, target, before, value, limit)) : Optional.empty();
    }
}
