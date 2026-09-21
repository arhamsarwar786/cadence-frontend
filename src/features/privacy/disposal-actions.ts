/** Re-exports write doors for call sites that prefer an actions module. */
export {
  delayDisposal,
  destroyDisposal,
  holdDisposal,
  releaseDisposal,
} from "@/features/privacy/disposal-api";
