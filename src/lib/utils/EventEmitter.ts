type EventCallback = (...args: any[]) => void;

export class EventEmitter {
    private events: { [key: string]: EventCallback[] } = {};

    on(event: string, callback: EventCallback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return this;
    }

    off(event: string, callback: EventCallback) {
        if (!this.events[event]) return this;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
        return this;
    }

    emit(event: string, ...args: any[]) {
        if (!this.events[event]) return false;
        this.events[event].forEach(callback => callback(...args));
        return true;
    }
}