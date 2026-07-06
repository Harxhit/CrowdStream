import {Mutex} from 'async-mutex';

export const workerMutex = new Mutex()