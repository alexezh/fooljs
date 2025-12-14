import { AstNode, cloneAst, createAdd, createDiv, createMul, createNeg, createPow, createSqrt, createSub, isFunc, isNumber } from './ast.js';

function expectQuadraticTerms(terms: ReadonlyArray<AstNode>): {
  A: AstNode;
  B: AstNode;
  C: AstNode;
  variable: AstNode;
} {
  if (terms.length !== 3) {
    throw new Error('Quadratic equation must have three terms');
  }

  const [termA, termB, termC] = terms;

  if (!isFunc(termA, 'mul')) {
    throw new Error('First term must be mul(A, pow(x, 2))');
  }
  const termAArgs = termA.children ?? [];
  if (termAArgs.length !== 2) {
    throw new Error('mul(A, pow(x, 2)) must have two arguments');
  }
  const coeffA = termAArgs[0];
  const powNode = termAArgs[1];
  if (!isNumber(coeffA)) {
    throw new Error('Coefficient A must be a number');
  }
  if (!isFunc(powNode, 'pow')) {
    throw new Error('First term must include pow(x, 2)');
  }
  const powArgs = powNode.children ?? [];
  if (powArgs.length !== 2 || !isNumber(powArgs[1]) || powArgs[1].value !== 2) {
    throw new Error('Exponent must be 2 in pow(x, 2)');
  }
  const variable = powArgs[0];

  if (!isFunc(termB, 'mul')) {
    throw new Error('Second term must be mul(B, x)');
  }
  const termBArgs = termB.children ?? [];
  if (termBArgs.length !== 2) {
    throw new Error('mul(B, x) must have two arguments');
  }
  const coeffB = termBArgs[0];
  const variableTerm = termBArgs[1];
  if (!isNumber(coeffB)) {
    throw new Error('Coefficient B must be a number');
  }

  if (variableTerm.toString() !== variable.toString()) {
    throw new Error('Variables must match between terms');
  }

  if (!isNumber(termC)) {
    throw new Error('Constant term must be a number');
  }

  if (coeffA.value === 0) {
    throw new Error('Coefficient A must be non-zero');
  }

  return {
    A: coeffA,
    B: coeffB,
    C: termC,
    variable
  };
}

export function solve(exp: AstNode, goal: AstNode): AstNode {
  if (!isFunc(exp, 'eq')) {
    throw new Error('solve expects an equation eq(lhs, rhs)');
  }

  const eqArgs = exp.children ?? [];
  if (eqArgs.length !== 2) {
    throw new Error('eq must have two arguments');
  }

  const [lhs, rhs] = eqArgs;

  if (!isFunc(lhs, 'sum')) {
    throw new Error('Quadratic solver expects normalized sum on the left-hand side');
  }

  if (!isNumber(rhs) || rhs.value !== 0) {
    throw new Error('Right-hand side must be zero for quadratic solver');
  }

  const { A, B, C } = expectQuadraticTerms(lhs.children ?? []);

  const powB2 = createPow(cloneAst(B), 2);
  const four = AstNode.create('number', 4);
  const mulAC = createMul(cloneAst(A), cloneAst(C));
  const fourAC = createMul(four, mulAC);
  const discriminant = createSub(powB2, fourAC);

  const sqrtD = createSqrt(cloneAst(discriminant));
  const negB = createNeg(cloneAst(B));
  const twoA = createMul(AstNode.create('number', 2), cloneAst(A));

  const root1 = createDiv(
    createAdd(cloneAst(negB), cloneAst(sqrtD)),
    cloneAst(twoA)
  );

  const root2 = createDiv(
    createSub(cloneAst(negB), cloneAst(sqrtD)),
    twoA
  );

  return AstNode.create('list', 'list', [root1, root2]);
}

// export function aStarSearch(startModel: AModel): AModel[] | null {
//   const heap = new MinHeap<AModel>((a, b) => {
//     const aTotal = a.remainCost;
//     const bTotal = b.remainCost;
//     return aTotal - bTotal;
//   });

//   heap.push(startModel);

//   const visited = new Set<string>();

//   while (heap.length > 0) {
//     const endOfChain: AModel[] = [];
//     while (heap.length > 0) {
//       const model = heap.pop()!;

//       const stateKey = modelToKey(model);
//       if (visited.has(stateKey)) {
//         continue;
//       }
//       visited.add(stateKey);

//       if (isLinearExpressionGoal(model.refs)) {
//         return getModelPath(model);
//       }

//       let isEnd = true;
//       // Get all possible next states using generators
//       for (const actionResult of getAllActions(model)) {
//         const { action, model: nextModel, next } = actionResult;
//         const nextKey = modelToKey(nextModel);

//         if (!visited.has(nextKey)) {
//           heap.push(nextModel);
//           isEnd = false;

//           // Continue getting models from this action while remainCost improves
//           let prevRemainCost = nextModel.remainCost;
//           for (const furtherModel of next) {
//             if (furtherModel.remainCost >= prevRemainCost) {
//               break; // Cost is not improving, stop this action
//             }

//             const furtherKey = modelToKey(furtherModel);
//             if (!visited.has(furtherKey)) {
//               heap.push(furtherModel);
//               prevRemainCost = furtherModel.remainCost;
//             }
//           }
//         }
//       }

//       if (isEnd) {
//         endOfChain.push(model);
//       }
//     }

//     // Execute delayed operations for end-of-chain models and continue search
//     for (const model of endOfChain) {
//       const changes = executeLazyCompute(model);
//       if (changes) {
//         // New state after execution - add to heap for further exploration
//         heap.push(model);
//       }
//     }

//     endOfChain.length = 0;
//   }

//   return null;
// }

// function executeLazyCompute(model: AModel): boolean {
//   // if (!model.requireCompute) {
//   //   return false;
//   // }
//   let chain: AModel[] = [];
//   let cur: AModel | undefined = model;
//   while (cur) {
//     chain.push(cur);
//     cur = cur.parent;
//   }

//   let changed = false;
//   for (let idx = chain.length - 1; idx >= 0; idx--) {
//     let cur = chain[idx];
//     if (cur.computeRefs) {
//       let hasCompute = false;
//       for (let idx = 0; idx < cur.computeRefs.length; idx++) {
//         let compute = cur.computeRefs[idx];
//         if (compute) {
//           const refChanged = compute.compute!();
//           if (refChanged) {
//             changed = true;
//             cur.computeRefs[idx] = null;
//           } else {
//             hasCompute = true;
//           }
//         }
//       }
//       if (!hasCompute) {
//         cur.computeRefs = undefined;
//       }
//     }
//   }
//   return changed;
// }
