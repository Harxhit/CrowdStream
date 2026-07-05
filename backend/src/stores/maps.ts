import { Room, TransportInfo , WorkerInfo, WorkerLoad} from "../types/mediasoup";
import type { Router } from "mediasoup/node/lib/types";

/**
 * Maps a room ID to its in-memory room state.
 */
export const memoryRoom = new Map<string, Room>();

/**
 * Maps a router ID to its corresponding mediasoup Router instance.
 */
export const routers = new Map<string, Router>();

/**
 * Maps a router ID to the worker ID that owns it.
 */
export const routerToWorker = new Map<string, string>();

/**
 * Maps a router ID to the room ID it serves.
 */
export const routerToRoom = new Map<string, string>();

/**
 * Maps a room ID to the router ID assigned to it.
 */
export const roomToRouter = new Map<string, string>();

/**
 * Global registry of active transports, indexed by transport ID.
 */
export const transportRegistry = new Map<string, TransportInfo>();

/**
 * Stores runtime information and metrics for each mediasoup worker.
 */
export const workerPool = new Map<string, WorkerInfo>()

export const workerLoadMap  = new Map<string, WorkerLoad>()