/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { Queue } from 'workbox-background-sync'

declare const self: ServiceWorkerGlobalScope;

// Precache todos los assets estáticos
precacheAndRoute(self.__WB_MANIFEST)

// Cola para sincronización en segundo plano
const syncQueue = new Queue('syncQueue')

// Ruta para las llamadas de API
registerRoute(
    /^https:\/\/api\.*/i,
    async (options) => {
        try {
            const strategy = new NetworkOnly()
            return await strategy.handle(options)
        } catch (error) {
            await syncQueue.pushRequest({ request: options.request })
            throw error
        }
    },
    'POST'
)

// Ruta para obtener datos
registerRoute(
    /^https:\/\/api\.*/i,
    new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10
    }),
    'GET'
)