import React from 'react';
import { getStatic } from '@/util-static'
import { ipcRenderer } from 'electron';

import './style.scss';

export default ( props ) => {
    function onLinkClick(event) {
        ipcRenderer.send('openBrowserTo', event.target.getAttribute("data-href"));
    }

    return (
        <div id="header">
            <img src={getStatic('logo.svg')} alt=""></img>
            <h1>FreeKnife</h1>
            <a onClick={onLinkClick} data-href="https://github.com/OddPig/FreeKnife">Contribute on GitHub</a>
            <button onClick={props.onButtonClick}>{props.buttonText}</button>
        </div>
    );
};