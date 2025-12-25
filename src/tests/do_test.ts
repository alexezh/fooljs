import { parse } from "../parser.js";

console.log("=== Testing 'do' syntax ===\n");

// Test 1: Simple do block
try {
  const input1 = "solve(eq(?lhs, ?rhs)) => do [eq(?lhs, ?rhs) => eq(sub(?lhs, ?rhs), 0), eq(sub(?a, ?b), 0) => eq(sum(?a, neg(?b)), 0)]";
  console.log("Test 1: Simple do block");
  console.log("Input:", input1);
  const result1 = parse(input1);
  console.log("Parsed successfully!");
  console.log("Kind:", result1.kind);
  console.log("Children:", result1.children?.length);
  if (result1.children && result1.children.length >= 2) {
    const [pattern, doBlock] = result1.children;
    console.log("Pattern:", pattern.toString());
    console.log("DoBlock kind:", doBlock.kind);
    console.log("DoBlock children:", doBlock.children?.length);
    if (doBlock.children) {
      doBlock.children.forEach((rule, i) => {
        console.log(`  Rule ${i}:`, rule.toString());
      });
    }
  }
  console.log("toString():", result1.toString());
  console.log("✓ Test 1 passed\n");
} catch (e) {
  console.log("✗ Test 1 failed:", e);
  console.log();
}

// Test 2: Do block with where clause
try {
  const input2 = "eq(sum(?terms...), ?b) => do [eq(sum(?terms...), ?b) => eq(mul(?x, sum(?qs...)), ?b) where map_div_by_x([?terms...], ?x) => [?qs...]]";
  console.log("Test 2: Do block with where clause");
  console.log("Input:", input2);
  const result2 = parse(input2);
  console.log("Parsed successfully!");
  console.log("toString():", result2.toString());
  console.log("✓ Test 2 passed\n");
} catch (e) {
  console.log("✗ Test 2 failed:", e);
  console.log();
}

// Test 3: Simple rule (backward compatibility)
try {
  const input3 = "eq(?a, ?b) => eq(?b, ?a)";
  console.log("Test 3: Simple rule (backward compatibility)");
  console.log("Input:", input3);
  const result3 = parse(input3);
  console.log("Parsed successfully!");
  console.log("Kind:", result3.kind);
  console.log("toString():", result3.toString());
  console.log("✓ Test 3 passed\n");
} catch (e) {
  console.log("✗ Test 3 failed:", e);
  console.log();
}

console.log("=== All tests completed ===");
