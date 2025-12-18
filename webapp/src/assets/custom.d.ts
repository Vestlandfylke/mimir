declare module '*.svg' {
    import * as React from 'react';

    export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

    const src: string;
    export default src;
}
declare module '*.png' {
    import * as React from 'react';

    export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

    const src: string;
    export default src;
}

// Mermaid (diagram renderer)
// We declare this module because the webapp tsconfig uses moduleResolution "Node",
// which can fail to resolve packages that publish types via "exports".
declare module 'mermaid' {
    export type MermaidSecurityLevel = 'strict' | 'loose' | 'antiscript';

    export interface MermaidConfig {
        startOnLoad?: boolean;
        securityLevel?: MermaidSecurityLevel;
        theme?: string;
    }

    export interface MermaidRenderResult {
        svg: string;
        bindFunctions?: (element: Element) => void;
    }

    export interface MermaidAPI {
        initialize: (config: MermaidConfig) => void;
        render: (id: string, text: string) => Promise<MermaidRenderResult>;
    }

    const mermaid: MermaidAPI;
    export default mermaid;
}
