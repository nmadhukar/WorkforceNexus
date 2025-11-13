// Allow DocuSeal web components in TSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'docuseal-form': any;
      'docuseal-builder': any;
    }
  }
}
export {};



