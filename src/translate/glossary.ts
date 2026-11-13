/**
 * Curated English terminology for software-engineering prose.
 *
 * Machine translators render idioms like "functional core, imperative shell"
 * word by word ("功能核心"), which loses the meaning. Seeded into the LLM
 * prompt so short headings resolve as terminology instead of dictionary glosses.
 * Keep entries multiword or unambiguous; single common words ("core", "shell",
 * "cache") are context dependent and belong to the model, not to a fixed list.
 */
export const CODING_GLOSSARY: readonly (readonly [string, string])[] = [
  ["functional core", "函数式核心"],
  ["imperative shell", "命令式外壳"],
  ["pure function", "纯函数"],
  ["side effect", "副作用"],
  ["higher-order function", "高阶函数"],
  ["dependency injection", "依赖注入"],
  ["inversion of control", "控制反转"],
  ["event sourcing", "事件溯源"],
  ["race condition", "竞态条件"],
  ["garbage collection", "垃圾回收"],
  ["closure", "闭包"],
  ["currying", "柯里化"],
  ["memoization", "记忆化"],
  ["idempotent", "幂等"],
  ["throughput", "吞吐量"],
  ["bounded context", "限界上下文"],
  ["technical debt", "技术债"],
];

/** Glossary block for the prompt, or "" when the target is not Chinese. */
export function glossaryLines(target: string): string {
  if (!target.startsWith("zh")) return "";
  const lines = CODING_GLOSSARY.map(([source, translated]) => `- "${source}" -> ${translated}`);
  return [
    "Preferred software-engineering terminology:",
    ...lines,
    "Use these renderings when the source segment contains the term.",
  ].join("\n");
}
