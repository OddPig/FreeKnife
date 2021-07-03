import React from 'react';
import Logger from '../util-logger.js';
import { ipcRenderer } from 'electron';

import './style.scss';


export default class WelcomePage extends React.Component {
    constructor(props) {
        super(props);
        this.state = { value: '', bg: "bg" + Math.ceil(Math.random() * 5) };

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange(event) {
        this.setState({ value: event.target.value });
    }

    handleAccept(event) {
        this.props.setAcceptedWarning();
        event.preventDefault();
    }

    handleSubmit(event) {
        let keys = this.validateKeys(this.state.value);
        if (keys.isValid) {
            Logger.log("Got new valid-looking keys!");
            this.props.setKeys(keys.keys);
        } else {
            //todo add way to bypass this in case we're wrong
            Logger.error(`Rejected invalid-looking keys with checksum of ${keys.checksum}`);
            alert("Sorry, but those keys don't look right. Please check the wiki page and try again.");
        }
        event.preventDefault();
    }

    validateKeys(value) {
        var keys = value.split("\n");

        var checksum = 0;
        const correctChecksum = 17506; //magic number based on the keys I extracted

        for (let i = 0; i < keys.length; i++) {
            keys[i] = keys[i].trim();
            for (let ch = 0; ch < keys[i].length; ch++) {
                checksum += keys[i].charCodeAt(ch);
            }
        }
        //todo better validation - key length, number of keys

        return {
            keys: keys,
            isValid: checksum == correctChecksum,
            checksum: checksum
        };
    }

    onLinkClick(event) {
        ipcRenderer.send('openBrowserTo', event.target.getAttribute("data-href"));
    }

    getContent() {
        if (!this.props.warningAccepted) {
            return (
                <div className="welcome-modal">
                    <h1>Welcome to FreeKnife!</h1>
                    <p>This program is an unoffical open-source controller for Cricut brand cutting machines. This extremely early version of this program has bugs, and may damage your machine. This version is designed for people who will test this software and report bugs.</p>
                    <p>Do you work for Cricut? If so, please check out the open letter <a onClick={this.onLinkClick} data-href="https://github.com/OddPig/FreeKnife/blob/main/OPENLETTER.md">here.</a> </p>
                    <p>This program is free software. It comes without any warranty, to the extent permitted by applicable law.</p>
                    <p>This program is not associated with Cricut, Inc. “Cricut” and all related elements are copyrights of Cricut, Inc.</p>
                    <button onClick={this.props.setAcceptedWarning} >I understand and accept the above warnings</button>
                </div>
            )
        } else {
            return (
                <div className="welcome-modal">
                    <h1>Welcome to FreeKnife!</h1>
                    <p>Before we get started we need you to paste Cricut’s encryption keys below. We need these talk to your device.
                    </p>
                    <p>For legal reasons we can’t distribute these keys ourselves. Please see this <a onClick={this.onLinkClick} data-href="https://github.com/mmozeiko/aes-finder">page (TODO add better link)</a> for a
                        guide on how to extract the keys. There are four alphanumeric keys - please enter one per line without commas or quotes.</p>
                    <textarea rows="4" cols="50" value={this.value} onChange={this.handleChange}></textarea>
                    <button onClick={this.handleSubmit} >Go</button>
                </div>
            )
        }
    }

    render() {
        return (
            <div className={"page page-welcome " + this.state.bg} >
                {this.getContent()}
            </div>
        );
    }
}


