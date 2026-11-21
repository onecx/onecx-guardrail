import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

/** Extracts the HEAD version of all accepted files into a directory. */
record HeadTree(Git git, Config cfg) {
    Tree extract(Path tmp) throws IOException {
        boolean hasHead = git.tryRun("rev-parse", "--verify", "HEAD").isPresent();
        Set<String> paths = hasHead ? git.nul("ls-tree", "-r", "-z", "--name-only", "HEAD") : Set.of();
        for (String p : paths) {
            if (cfg.accepts(p)) {
                Files.createDirectories(tmp.resolve(p).getParent());
                Files.writeString(tmp.resolve(p), git.run("show", "HEAD:" + p), StandardCharsets.UTF_8);
            }
        }
        return new Tree(tmp, paths);
    }
}
