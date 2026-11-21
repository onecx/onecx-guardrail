import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Collects the inspected files and all measures and cycles of the working tree. */
record Gatherer(OnecxGuardrail o, Git git, Config cfg) {
    Facts gather() throws IOException {
        Set<String> tracked = git.nul("ls-files", "-z", "--cached", "--others", "--exclude-standard");
        Tree now = new Tree(git.root(), tracked);
        Set<String> candidates = o.staged ? git.nul("diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR") : tracked;
        List<String> files = new ArrayList<>(now.java(cfg));
        files.retainAll(candidates);
        Analyzer analyzer = new Analyzer(cfg);
        List<Measure> measures = new ArrayList<>();
        for (String f : files) {
            measures.addAll(analyzer.analyze(git.root(), f));
        }
        return new Facts(files, measures, PackageCycles.find(now, cfg));
    }
}
