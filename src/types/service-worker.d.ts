/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface WorkboxManifest {
    revision: string;
    url: string;
}

declare global {
    interface ServiceWorkerGlobalScope {
        __WB_MANIFEST: Array<WorkboxManifest>;
    }
}

export { };