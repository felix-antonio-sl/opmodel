import { exposeSemanticKernel } from "../semantic-kernel";
import { renderAllFromKernelNative } from "../opl";
import type { SemanticKernel } from "../semantic-kernel";

export function kernelToOpl(kernel: SemanticKernel): string {
  const atlas = exposeSemanticKernel(kernel);
  return renderAllFromKernelNative(kernel, atlas);
}
