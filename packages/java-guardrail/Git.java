import java.lang.ProcessBuilder.Redirect;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

/** git through ProcessBuilder. */
record Git(Path root) {
    Optional<String> tryRun(String... args) {
        List<String> cmd = new ArrayList<>(List.of("git", "-c", "core.quotepath=off"));
        cmd.addAll(Arrays.asList(args));
        try {
            Process p = new ProcessBuilder(cmd).directory(root.toFile()).redirectError(Redirect.DISCARD).start();
            String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            return p.waitFor() == 0 ? Optional.of(out) : Optional.empty();
        } catch (java.io.IOException | InterruptedException e) {
            return Optional.empty();
        }
    }

    /** Repository at the given root, or at the top level of the current directory. */
    static Git discover(Path root) {
        Path dir = root != null ? root.toAbsolutePath().normalize()
            : Path.of(new Git(Path.of("").toAbsolutePath()).run("rev-parse", "--show-toplevel").trim());
        return new Git(dir);
    }

    Path defaultBaseline() {
        return root.resolve(".guardrail-baseline.json");
    }

    String run(String... args) {
        return tryRun(args).orElseThrow(() -> new IllegalStateException("git " + String.join(" ", args) + " failed"));
    }

    /** NUL-separated output as a sorted set. */
    Set<String> nul(String... args) {
        Set<String> out = new TreeSet<>(Arrays.asList(run(args).split("\0")));
        out.remove("");
        return out;
    }
}
