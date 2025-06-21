import express from 'express';
import type { AsanaClientWrapper } from './asana-client-wrapper.js';
export declare function createHttpServer(asanaClient: AsanaClientWrapper): express.Application;
