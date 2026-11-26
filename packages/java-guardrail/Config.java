import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

record Thresholds(int maxFunctionLines, int maxTestFunctionLines, int maxFileLines, int maxCyclomatic,
    int maxCognitive, int maxNesting, int maxSwitchCases, int maxParameters, int maxConstructorParameters,
    int maxFanOut) {}

/** Effective configuration: embedded defaults deep-merged with the optional user file. */
record Config(Thresholds thresholds, List<String> suppressionPatterns, List<String> include, List<String> exclude,
    List<String> testFilePatterns) {
    // Embedded copy of shared/default-config.json (verified by check-embedded-config.sh).
    static final String DEFAULT_CONFIG = """
{
  "$schema": "./config.schema.json",
  "version": 1,
  "thresholds": {
    "maxFunctionLines": 25,
    "maxTestFunctionLines": 50,
    "maxFileLines": 250,
    "maxCyclomatic": 10,
    "maxCognitive": 15,
    "maxNesting": 3,
    "maxSwitchCases": 5,
    "maxParameters": 3,
    "maxConstructorParameters": 6,
    "maxFanOut": 15,
    "jscpdMinLines": 15,
    "jscpdMinTokens": 120
  },
  "suppressionPatterns": [
    "\u004eOPMD",
    "\u0040SuppressWarnings",
    "eslint-\u0064isable",
    "\u0040ts-ignore",
    "\u0040ts-expect-error",
    "jscpd:\u0069gnore"
  ],
  "include": [],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/target/**", "**/build/**", "**/generated/**"],
  "testFilePatterns": [
    "*.spec.ts", "*.test.ts", "*Test.java", "*Tests.java", "*IT.java",
    "**/src/test/**", "**/__tests__/**", "**/e2e/**", "**/test/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
  ]
}
""";

    /** Thresholds merge key-wise; list options replace the defaults. */
    static Config load(Optional<Path> file) throws IOException {
        ObjectNode merged = (ObjectNode) Json.MAPPER.readTree(DEFAULT_CONFIG);
        if (file.isPresent()) {
            Json.MAPPER.readTree(Files.readString(file.get())).fields().forEachRemaining(e -> {
                if (e.getValue() instanceof ObjectNode o && merged.get(e.getKey()) instanceof ObjectNode base) {
                    base.setAll(o);
                } else {
                    merged.set(e.getKey(), e.getValue());
                }
            });
        }
        return Json.MAPPER.treeToValue(merged, Config.class);
    }

    /** Explicit file, else root/.guardrailrc.json if present, merged over the defaults. */
    static Config resolve(Path explicit, Path root) throws IOException {
        Path rc = explicit != null ? explicit : root.resolve(".guardrailrc.json");
        return load(Optional.of(rc).filter(p -> explicit != null || Files.exists(p)));
    }

    boolean isTest(String path) {
        return Globs.matches(testFilePatterns, path);
    }

    boolean accepts(String path) {
        return path.endsWith(".java") && (include.isEmpty() || Globs.matches(include, path))
            && !Globs.matches(exclude, path);
    }
}
