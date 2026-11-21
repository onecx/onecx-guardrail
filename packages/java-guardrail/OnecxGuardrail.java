//JAVA 17+
//DEPS net.sourceforge.pmd:pmd-java:7.7.0
//DEPS net.sourceforge.pmd:pmd-core:7.7.0
//DEPS com.fasterxml.jackson.core:jackson-databind:2.17.2
//DEPS info.picocli:picocli:4.7.6
//DEPS org.jgrapht:jgrapht-core:1.5.2
//DEPS org.slf4j:slf4j-nop:1.7.36
//SOURCES AddedLines.java Analyzer.java Baseline.java BaselineWriter.java Checks.java Collector.java Config.java CycleChecks.java Facts.java Gatherer.java Git.java Globs.java Head.java HeadTree.java Imports.java Json.java Measure.java MetricChecks.java MethodMetrics.java Output.java PackageCycles.java Pmd.java PmdLanguage.java PmdParse.java Previous.java Result.java Run.java Scc.java Shape.java Sink.java Skipped.java Suppressions.java TempDirs.java Tree.java TypeMetrics.java Violation.java

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Callable;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Model.CommandSpec;
import picocli.CommandLine.Option;
import picocli.CommandLine.ParseResult;
import picocli.CommandLine.Spec;

/** onecx-guardrail (Java runtime): deterministic Clean Code ratchet backed by PMD 7.7.0 metrics. */
@Command(name = "onecx-guardrail", mixinStandardHelpOptions = true, version = OnecxGuardrail.VERSION,
    description = "Deterministic Clean Code and architecture checks with a ratchet (PMD metrics).")
public class OnecxGuardrail implements Callable<Integer> {
    static final String VERSION = "0.1.0";

    @Option(names = "--staged", description = "Inspect only staged files, compared against HEAD") boolean staged;
    @Option(names = "--baseline", description = "Ratchet baseline file") Path baseline;
    @Option(names = "--init-baseline", description = "Write the baseline from the current state") boolean initBaseline;
    @Option(names = "--strict", description = "Ignore baseline and HEAD") boolean strict;
    @Option(names = "--config", description = ".guardrailrc.json") Path config;
    @Option(names = "--format", defaultValue = "agent", description = "agent | json") String format;
    @Option(names = "--root", description = "Repository root") Path root;
    @Spec CommandSpec spec;

    public static void main(String[] args) {
        CommandLine cmd = new CommandLine(new OnecxGuardrail()).setExecutionExceptionHandler(OnecxGuardrail::fail);
        System.exit(cmd.execute(args));
    }

    private static int fail(Exception e, CommandLine cmd, ParseResult result) {
        System.err.println("onecx-guardrail: " + e.getMessage());
        return 2;
    }

    @Override
    public Integer call() throws IOException {
        if (!List.of("agent", "json").contains(format)) {
            throw new IllegalArgumentException("--format must be agent or json");
        }
        return new Run(this).execute();
    }
}
