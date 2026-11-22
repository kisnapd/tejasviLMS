import {verified} from './common.mjs';
import {startServer} from './server-core.mjs';
await startServer(await verified());
