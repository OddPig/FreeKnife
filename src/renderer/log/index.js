import React, { useEffect, useContext } from 'react';

import './style.scss';

export default (props) => {

    useEffect(() => {
        var logEl = document.getElementById("log");//TODO should be a ref
        /*var notScrolled = logEl.scrollHeight - logEl.clientHeight - logEl.scrollTop < 3; //3 chosen as arbitrary small number, pixel threshold for detemining what's close enough to count as not scrolled
        console.log(logEl.scrollHeight - logEl.clientHeight - logEl.scrollTop);
        if (notScrolled) {
            logEl.scrollTo(0, logEl.scrollHeight);
        }*/
        logEl.scrollTo(0, logEl.scrollHeight);
    });

    return (
        <div id="log">
            {props.logItems.map((item, i) =>
                <div key={i} className={"log-" + item.severity.toLowerCase()} >{item.msg}</div>
            )}
        </div>
    );
};