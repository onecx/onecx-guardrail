import java.util.List;
import java.util.Set;

/** Everything measured in the working tree. */
record Facts(List<String> files, List<Measure> measures, Set<String> cycles) {}
