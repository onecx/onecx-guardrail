import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** The state before the change: HEAD extracted into an isolated temp dir and analysed there. */
record Head(Git git, Config cfg) {
    Baseline load(List<String> files) throws IOException {
        Path tmp = Files.createTempDirectory("onecx-guardrail-");
        try {
            Tree head = new HeadTree(git, cfg).extract(tmp);
            List<String> same = new ArrayList<>(head.java(cfg));
            same.retainAll(files);
            return Baseline.of(new Analyzer(cfg).metrics(tmp, same), PackageCycles.find(head, cfg));
        } finally {
            TempDirs.delete(tmp);
        }
    }
}
