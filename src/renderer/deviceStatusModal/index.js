import React from 'react';

import './style.scss';

export default (props) => {
    function getDescription() {
        if (props.deviceStatus == "Not Connected") {
            return "This modal should not exist. File a bug report."
        } else if (props.deviceStatus == "Waiting For Material") {
            return "Load your cutting mat and press the load/unload button (with the arrows)."
        }
        
        return "Please wait..."
    }
    if (props.deviceStatus && props.deviceStatus != "Not Connected" && props.deviceStatus != "Done") {
        return (
            <div className="device-status-modal-wrapper">
                <div className="device-status-modal">
                    <h2>Device Status: {props.deviceStatus}</h2>
                    <p>{getDescription()}</p>
                </div>
            </div>
        );
    } else {
        return null;
    }
    
};