import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTAnonymousClassDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTExecutableDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTSwitchLike;
import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.ast.JavaNode;

/** Custom walks for what PMD's metrics do not offer: nesting depth, switch cases, boolean flag parameters. */
final class Shape {
    private static final Set<String> NEST = Set.of("IfStatement", "ForStatement", "ForeachStatement",
        "WhileStatement", "DoStatement", "SwitchStatement", "TryStatement", "CatchClause");

    /** Max depth of nested if/for/while/do/switch/try/catch; an else-if does not nest. */
    static int nesting(JavaNode node) {
        if (node instanceof ASTTypeDeclaration || node instanceof ASTAnonymousClassDeclaration) {
            return 0;
        }
        int deepest = 0;
        for (JavaNode child : node.children()) {
            deepest = Math.max(deepest, nesting(child));
        }
        boolean elseIf = node.getParent() != null && node.getParent().getXPathNodeName().equals("IfStatement")
            && node.getIndexInParent() == 2;
        return deepest + (NEST.contains(node.getXPathNodeName()) && !elseIf ? 1 : 0);
    }

    /** Max number of non-default case labels over all switches of the method. */
    static int switchCases(ASTExecutableDeclaration m) {
        int max = 0;
        for (ASTSwitchLike s : m.descendants(ASTSwitchLike.class)) {
            max = Math.max(max, (int) s.getBranches().filter(b -> !b.isDefault()).count());
        }
        return max;
    }

    /** Number of boolean/Boolean parameters of non-setter, non-@Override methods. */
    static int flags(ASTExecutableDeclaration m) {
        boolean setter = m.getArity() == 1 && m.getName().matches("set[A-Z].*");
        if (setter || m.isAnnotationPresent(Override.class)) {
            return 0;
        }
        return (int) m.getFormalParameters().toStream()
            .filter(p -> p.getTypeNode().getText().toString().matches("[bB]oolean")).count();
    }
}
