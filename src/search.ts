import { MinHeap } from './minheap.js';
import { AModel } from './model.js';

function isGoal(model: AModel): boolean {
  return true;
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

