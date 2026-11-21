import java.nio.file.FileSystems;
import java.nio.file.Path;
import java.nio.file.PathMatcher;
import java.util.List;

/** Glob matching against the path, the rooted path and the file name. */
final class Globs {
    static boolean matches(List<String> globs, String path) {
        Path p = Path.of(path);
        for (String g : globs) {
            PathMatcher m = FileSystems.getDefault().getPathMatcher("glob:" + g);
            if (m.matches(p) || m.matches(Path.of("/" + path)) || m.matches(p.getFileName())) {
                return true;
            }
        }
        return false;
    }
}
