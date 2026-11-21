import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** A set of project paths rooted at a directory (working tree or an extracted HEAD tree). */
record Tree(Path dir, Set<String> paths) {
    private static final Set<String> BUILD = Set.of("pom.xml", "build.gradle", "build.gradle.kts");

    List<String> java(Config cfg) {
        List<String> out = new ArrayList<>();
        for (String p : paths) {
            if (cfg.accepts(p) && Files.isRegularFile(dir.resolve(p))) {
                out.add(p);
            }
        }
        return out;
    }

    /** Nearest ancestor directory holding a build file, else the root (empty string). */
    String module(String path) {
        for (Path d = Path.of(path).getParent(); d != null; d = d.getParent()) {
            String prefix = d + "/";
            if (BUILD.stream().anyMatch(b -> paths.contains(prefix + b))) {
                return d.toString();
            }
        }
        return "";
    }
}
