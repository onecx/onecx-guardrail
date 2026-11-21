import java.io.IOException;

/** One guardrail execution: collect, compare with the previous state, report. */
final class Run {
    private final OnecxGuardrail o;
    private final Git git;
    private final Config cfg;

    Run(OnecxGuardrail o) throws IOException {
        this.o = o;
        this.git = Git.discover(o.root);
        this.cfg = Config.resolve(o.config, git.root());
    }

    int execute() throws IOException {
        Facts facts = new Gatherer(o, git, cfg).gather();
        if (o.initBaseline) {
            BaselineWriter.write(Baseline.of(facts), o.baseline != null ? o.baseline : git.defaultBaseline());
            return 0;
        }
        Baseline prev = new Previous(o, git, cfg).load(facts.files());
        return new Output(o).print(new Checks(o, git, cfg).run(facts, prev), facts.files().size());
    }
}
