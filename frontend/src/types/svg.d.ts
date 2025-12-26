/// <reference types="react" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      svg: React.SVGProps<SVGSVGElement>;
      path: React.SVGProps<SVGPathElement>;
      circle: React.SVGProps<SVGCircleElement>;
      linearGradient: React.SVGProps<SVGLinearGradientElement>;
      stop: React.SVGProps<SVGStopElement>;
      defs: React.SVGProps<SVGDefsElement>;
    }
  }
}

export {};