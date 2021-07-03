import { EventEmitter } from "events";
import { ipcRenderer } from 'electron';


class Logger extends EventEmitter {
    constructor() {
        super();
        //this.logMessages = [];
        ipcRenderer.on('log', this._handleIPC.bind(this));
        console.log("Logger started")
    }

    _logInternal(msg, severity = "INFO") {
        console.log(`LOGGER-[${severity}] ${msg}`);
        var obj = { msg: msg, severity: severity };
        //this.logMessages.push(obj);
        ipcRenderer.send('appendLogFile', `[${severity}] ${msg}`); //this is a bit spagetti-ish, can mean we're going backend to frontend to backend.
        this.emit('message', obj);
    }

    _handleIPC(event, arg) {
        if (arg.msg) {
            this._logInternal("Main: " + arg.msg, arg.severity);
        } else {
            this.error("Logger recieved invalid IPC: " + JSON.stringify(arg));
        }
    }

    log(msg) {
        this._logInternal(msg, "INFO")
    }

    error(msg) {
        this._logInternal(msg, "ERROR");
    }

    debug(msg) {
        this._logInternal(msg, "DEBUG");
    }
}

const logger = new Logger;

export default logger;
