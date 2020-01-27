/// <reference types="node" />

declare module 'tpf' {
    export interface Triple {
        Subject: string,
        Predicate: string,
        Object: string,
    }
    export class Client {
        constructor(endpoint: string)
        Query(subject: string, predicate: string, object: string, page?: number): Promise<Triple[]>;
    }
    export function Query(endpoint: string, subject: string, predicate: string, object: string, page?: number): Promise<Triple[]>;
}
