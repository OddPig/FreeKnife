import React, { useContext } from 'react';
import { ipcRenderer } from 'electron';

import './style.scss';

import Header from '../header';
import Legal from '../legal';
import Log from '../log';
import DeviceStatusModal from '../deviceStatusModal';
import PageWelcome from '../page-welcome';
import PageWorkspace from '../page-workspace';

import Logger from '../util-logger.js';

export default class Entry extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            prefs: false,
            log: [],
            deviceStatus: "Not Connected",
        };

        this.toggleLogShown = this.toggleLogShown.bind(this);
        this.addLogMsg = this.addLogMsg.bind(this);
        this.loadPrefs = this.loadPrefs.bind(this);
        this.setKeys = this.setKeys.bind(this);
        this.setAcceptedWarning = this.setAcceptedWarning.bind(this);
        this.addLogMessage = this.addLogMessage.bind(this);
        this.deviceStatusListener = this.deviceStatusListener.bind(this);
        Logger.log("Entry start");
    }

    componentDidMount() {
        ipcRenderer.send('loadPrefs');
        ipcRenderer.on('loadPrefs', this.loadPrefs);
        ipcRenderer.on('deviceStatus', this.deviceStatusListener);
        Logger.on('message', this.addLogMessage);
    }

    componentWillUnmount() {
        ipcRenderer.removeListener('deviceStatus', this.deviceStatusListener);
        ipcRenderer.removeListener('loadPrefs', this.loadPrefs);
    }

    addLogMessage(arg) {
        this.setState(prevState => ({
            log: [...prevState.log, arg]
        }));
    }

    loadPrefs(event, arg) {
        Logger.log("Prefs loaded.");
        this.setState({ prefs: arg });
    }

    updatePrefs(newPrefs) {
        Logger.log("Saving updated prefs.");
        ipcRenderer.send('updatePrefs', newPrefs);
    }

    deviceStatusListener(event, arg) {
        console.log(arg);
        Logger.log(`Device status changed to ${arg}`)
        this.setState({ deviceStatus: arg });
    }

    setKeys(newKeys) {
        let newPrefs = Object.assign({}, this.state.prefs);
        newPrefs.keys = newKeys;
        this.setState({ prefs: newPrefs });
        this.updatePrefs(newPrefs);
    }

    setAcceptedWarning() {
        let newPrefs = Object.assign({}, this.state.prefs);
        newPrefs.warningAccepted = true;
        this.setState({ prefs: newPrefs });
        this.updatePrefs(newPrefs);
    }

    getCurrentPage() {
        if (this.state.prefs) {
            if (this.state.prefs.keys && this.state.prefs.warningAccepted) {
                return <PageWorkspace deviceStatus={this.state.deviceStatus} keys={this.state.prefs.keys}></PageWorkspace>;
            } else {
                return <PageWelcome warningAccepted={this.state.prefs.warningAccepted} setKeys={this.setKeys} setAcceptedWarning={this.setAcceptedWarning}></PageWelcome>;
            }
        } else {
            return <div>Loading Prefs...</div>
        }

    }

    getLogSidebar() {
        if (this.state.prefs && this.state.prefs.showLog) {
            return <Log logItems={this.state.log}></Log>;
        }
        return null;
    }

    toggleLogShown() {
        let newPrefs = Object.assign({}, this.state.prefs);
        newPrefs.showLog = !newPrefs.showLog;
        this.setState({ prefs: newPrefs });
        this.updatePrefs(newPrefs);
    }

    addLogMsg(msg, severity = "info") {
        //BAD
        this.state.log.push({ msg: msg, severity: severity });
        console.log("Logger: " + msg);
    }

    render() {
        var page = this.getCurrentPage();
        var logSidebar = this.getLogSidebar();

        return (
            <div id="entry">
                <Header onButtonClick={this.toggleLogShown} buttonText={this.state.prefs.showLog ? "Hide Log" : "Show Log"}></Header>
                <div id="main">
                    {page}
                    {logSidebar}
                </div>
                <Legal></Legal>
                <DeviceStatusModal deviceStatus={this.state.deviceStatus}></DeviceStatusModal>
            </div>
        );
    };
}
