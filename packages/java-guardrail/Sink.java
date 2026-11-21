import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/** Collects measures of one file under a current symbol; the largest value wins per key. */
final class Sink {
    private final String file;
    private final Map<String, Measure> out = new LinkedHashMap<>();
    private String symbol = "-";

    Sink(String file) {
        this.file = file;
    }

    void symbol(String symbol) {
        this.symbol = symbol;
    }

    void add(String rule, int value, int limit) {
        if (value > 0 || limit > 0) {
            out.merge(rule + "|" + file + "|" + symbol, new Measure(rule, file, symbol, value, limit),
                (a, b) -> a.value() >= b.value() ? a : b);
        }
    }

    Collection<Measure> measures() {
        return out.values();
    }
}
