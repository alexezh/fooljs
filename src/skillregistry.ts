import { LlmClient } from "./llmclient";
import { SkillId } from "./runtime";
import { SkillDescriptor } from "./skilldescriptor";

/**
 * @deprecated
 */
export interface SkillEntry {
  descriptor: SkillDescriptor;
  embedding?: number[];
  topNode?: string; // Top-level function name for optimization (e.g., "eq", "sum")
}

/**
 * see SkillDescriptor for comment
 * registry is just a map from skill IDs to descriptor
 */
export class SkillRegistry {
  private skills: Map<string, SkillDescriptor> = new Map();

  constructor(private llmClient?: LlmClient) { }

  get(id: SkillId): SkillDescriptor | undefined {
    return this.skills.get(id);
  }
  add(skill: SkillDescriptor): void {
    if (this.skills.has(skill.id)) return;

    this.skills.set(skill.id, skill);
  }
}

//   async add(skill: SkillDescriptor): Promise<void> {
//     if (this.skills.has(skill.id)) return;

//     const entry: SkillEntry = {
//       descriptor: skill,
//     };

//     // Extract top node from pattern if it's a macro_action
//     if (skill.payload.kind === "macro_action") {
//       const firstPattern = skill.payload.match;
//       if (firstPattern) {
//         entry.topNode = this.extractTopNode(firstPattern);
//       }
//     }

//     // Generate embedding if LLM client is available
//     if (this.llmClient?.embed && skill.id) {
//       try {
//         const result = await this.llmClient.embed(skill.id);
//         entry.embedding = result.embedding;
//       } catch (e) {
//         // If embedding fails, continue without it
//         console.warn(`Failed to generate embedding for skill ${skill.id}:`, e);
//       }
//     }

//     this.skills.set(skill.id, entry);

//     // Index by top node
//     if (entry.topNode) {
//       if (!this.skillsByTopNode.has(entry.topNode)) {
//         this.skillsByTopNode.set(entry.topNode, []);
//       }
//       this.skillsByTopNode.get(entry.topNode)!.push(entry);
//     }
//   }

//   /**
//    * Find skills matching the given expression using embedding similarity.
//    * Optimizes by first checking top-level node, then using embeddings.
//    */
//   async findMatching(expr: AstNode, topK: number = 3): Promise<SkillDescriptor[]> {
//     // Extract top node from expression for optimization
//     const topNode = this.extractTopNodeFromAst(expr);

//     // Get candidate skills (filtered by top node if available)
//     let candidates: SkillEntry[];
//     if (topNode && this.skillsByTopNode.has(topNode)) {
//       candidates = this.skillsByTopNode.get(topNode)!;
//     } else {
//       candidates = [...this.skills.values()];
//     }

//     // If no LLM client or no embeddings, return all candidates
//     if (!this.llmClient?.embed) {
//       return candidates.slice(0, topK).map(e => e.descriptor);
//     }

//     // Get embedding for the expression
//     const exprStr = expr.toString();
//     let exprEmbedding: number[];
//     try {
//       const result = await this.llmClient.embed(exprStr);
//       exprEmbedding = result.embedding;
//     } catch (e) {
//       // If embedding fails, return top candidates by top node
//       return candidates.slice(0, topK).map(e => e.descriptor);
//     }

//     // Calculate similarities
//     const withScores = candidates
//       .filter(e => e.embedding) // Only consider entries with embeddings
//       .map(entry => ({
//         descriptor: entry.descriptor,
//         similarity: this.cosineSimilarity(exprEmbedding, entry.embedding!),
//       }))
//       .sort((a, b) => b.similarity - a.similarity);

//     return withScores.slice(0, topK).map(s => s.descriptor);
//   }

//   private extractTopNode(pattern: string): string | undefined {
//     // Extract function name from patterns like "eq(...)" or "sum(...)"
//     const match = pattern.match(/^([a-z_]+)\(/);
//     return match?.[1];
//   }

//   private extractTopNodeFromAst(expr: AstNode): string | undefined {
//     if (expr.kind === 'func' && typeof expr.value === 'string') {
//       return expr.value;
//     }
//     return undefined;
//   }

//   private cosineSimilarity(a: number[], b: number[]): number {
//     if (a.length !== b.length) return 0;
//     const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
//     const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
//     const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
//     if (magnitudeA === 0 || magnitudeB === 0) return 0;
//     return dotProduct / (magnitudeA * magnitudeB);
//   }
// }
