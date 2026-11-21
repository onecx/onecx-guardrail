import java.io.IOException;
import java.util.List;

/** Prints the result in the selected format and picks the exit code. */
record Output(OnecxGuardrail o) {
    int print(List<Violation> vs, int fileCount) throws IOException {
        if (o.format.equals("json")) {
            Result r = new Result("onecx-guardrail", OnecxGuardrail.VERSION, "java", vs.isEmpty(), vs);
            System.out.println(Json.MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(r));
        } else if (vs.isEmpty()) {
            System.out.println("[ONECX-GUARDRAIL PASSED] " + fileCount + " file(s) checked.");
        } else {
            System.err.println(failure(vs));
        }
        return vs.isEmpty() ? 0 : 1;
    }

    private String failure(List<Violation> vs) {
        String env = System.getenv("ONECX_GUARDRAIL_CMD");
        String args = String.join(" ", o.spec.commandLine().getParseResult().originalArgs());
        StringBuilder sb = new StringBuilder("[ONECX-GUARDRAIL FAILED] Commit blocked by deterministic Clean Code & architecture checks.\n"
            + "Do NOT add suppression comments (\u004eOPMD, \u0040SuppressWarnings, eslint-\u0064isable, jscpd:\u0069gnore).\n"
            + "Fix the design and re-run the guardrail.\n");
        for (int i = 0; i < vs.size(); i++) {
            sb.append(vs.get(i).render(i + 1));
        }
        return sb.append("\nRe-run: ").append((env != null ? env : "jbang guardrail@onecx " + args).trim()).toString();
    }
}
