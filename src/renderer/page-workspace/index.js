import React, { Fragment } from 'react';
import { FileDrop } from 'react-file-drop';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import sanitizeSVG from '@mattkrick/sanitize-svg'

import WorkspaceCanvas from './workspace-canvas'

import '../../../node_modules/path-data-polyfill/path-data-polyfill.js'

import './style.scss';
import Logger from '../util-logger.js';

export default class WorkspacePage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            filePaths: false,
            svgData: false,
            cutPaths: false,
            selectedDevice: false,
            deviceList: [],

            use0x5eEscape: true,
            useTwoByteLength: false,
            selectedKey: undefined,
            width: 12,
            height: 12,
        };

        if (props.keys && props.keys[0]) {
            this.state.selectedKey = props.keys[0];
        }

        this.handleFileDrop = this.handleFileDrop.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.refreshFiles = this.refreshFiles.bind(this);
        this.browseFiles = this.browseFiles.bind(this);
        this.browseFilesListener = this.browseFilesListener.bind(this);
        this.listDevicesListener = this.listDevicesListener.bind(this);
    }

    handleFileDrop(files) {
        this.validateAndLoadFiles(files);
    }

    refreshFiles() {
        if (this.state.filePaths) {
            this.validateAndLoadFiles(this.state.filePaths);
        }
    }

    browseFiles() {
        ipcRenderer.send('browseFile', {});
    }

    handleSubmit(event) {
        event.preventDefault();
        if (!this.state.selectedDevice) {
            alert("You need to select a device!");
            return;
        }
        if (!this.state.cutPaths) {
            alert("You need to load a file!");
            return;
        }
        ipcRenderer.send('beginJob', {
            path: this.state.selectedDevice,
            segments: this.reformatCutPaths(this.state.cutPaths),
            use0x5eEscape: this.state.use0x5eEscape,
            useTwoByteLength: this.state.useTwoByteLength,
            width: this.state.width,
            height: this.state.height,
            key: this.state.selectedKey,
        });
    }

    handleChange(event) {
        const target = event.target;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        const name = target.name;

        this.setState({
            [name]: value
        });
    }

    validateAndLoadFiles(files) {
        if (files.length != 1) {
            Logger.error("Rejected too many files.");
            alert("Sorry, we only support one file at a time right now.");
            return false;
        }
        if (typeof files[0] == "object" && files[0].type != "image/svg+xml") {
            //if not an obj, is a string coming from file browser (which returns a different format than file drop)
            Logger.error("Rejected invalid mime: " + files[0].type);
            alert("Sorry, we only support SVG files right now.");
            return false;
        }
        var path;
        if (typeof files[0] == "object") {
            path = files[0].path;
        } else if (typeof files[0] == "string") {
            path = files[0];
        } else {
            throw("File object is unexpected type");
        }
        Logger.log("New file: " + path);
        fs.readFile(path, (async function (err, data) {
            if (err) {
                Logger.error("Error reading file: " + err);
                return;
            }

            Logger.log("File read OK");
            var cleaned = await sanitizeSVG(data, window);
            this.setState({ filePaths: [path] });
            this.setState({ svgData: cleaned.toString() });
        }).bind(this));
    }

    formatFilePaths() {
        var out = [];
        for (let i = 0; i < this.state.filePaths.length; i++) {
            out.push(this.state.filePaths[i]);
        }
        return out.join(", ");
    }

    getWorkspaceContent() {
        if (this.state.svgData) {
            return (
                <Fragment>
                    <p>
                        {this.formatFilePaths()}
                        <br />
                        <a href="#" onClick={this.refreshFiles}>Refresh</a> - <a href="#" onClick={this.browseFiles}>Browse</a>
                    </p>
                    <WorkspaceCanvas cutPaths={this.state.cutPaths} sheetWidth={this.state.width} sheetHeight={this.state.height}></WorkspaceCanvas>
                </Fragment>
            );
        } else {
            return (
                <Fragment>
                    <h1>Drop your file here</h1>
                    <p>Or <a href="#" onClick={this.browseFiles}>browse</a>. Only SVG supported for now.</p>
                </Fragment>
            );
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!this.state.svgData) {
            return;
        }
        if (prevState.svgData != this.state.svgData) {
            this.generateCutPaths();
        }
    }

    componentDidMount() {
        ipcRenderer.send('listDevices');
        ipcRenderer.on('listDevices', this.listDevicesListener);
        ipcRenderer.on('browseFiles', this.browseFilesListener);
    }

    componentWillUnmount() {
        ipcRenderer.removeListener('listDevices', this.listDevicesListener);
        ipcRenderer.removeListener('browseFiles', this.browseFilesListener);
    }

    listDevicesListener(event, arg) {
        this.setState({ deviceList: arg });
        if (!this.state.selectedDevice) {
            //if no device, autoselect
            for (const dev of arg) {
                if (dev.isValidCutterDevice) {
                    //TODO check model and set args appropriately
                    this.setState({ selectedDevice: dev.path });
                    return;
                }
            }
        }
    }

    browseFilesListener(event, arg) {
        this.validateAndLoadFiles(arg)
    }

    generateCutPaths() {
        var div = document.createElement('div');
        document.body.append(div);
        div.innerHTML = this.state.svgData;

        // Change this to div.childNodes to support multiple top-level nodes (if we're supporting multiple files)
        var svg = div.getElementsByTagName('svg')[0];
        if (!svg) {
            throw "SVG missing from DOM.";
        }
        let bbox = svg.getBBox(); //used to scale SVG
        const margin = 1;
        var scale = 1 / 72; //72 ppi TODO let ppl configure this

        var scaleFitW = (this.state.width - margin * 2) / bbox.width;
        var scaleFitH = (this.state.height - margin * 2) / bbox.height;
        var scaleFit = Math.min(scaleFitW, scaleFitH);

        if (scale > scaleFit) {
            scale = scaleFit;
            Logger.log("Scaling oversied SVG to fit");
        }

        console.log(bbox);
        var paths = svg.querySelectorAll('path,rect,ellipse,circle,line,polygon')

        var cutPaths = [];

        for (const path of paths) {
            const sampleResolutionUnscaled = 0.02;
            const sampleResolution = sampleResolutionUnscaled / scale;
            let len = path.getTotalLength();

            var currentCutSeg = [];
            var lastPoint = { x: -99999, y: -99999 };

            for (let d = 0; d < len; d += sampleResolution) {
                var newPoint = path.getPointAtLength(d);
                newPoint = { type: 0, x: (newPoint.x - bbox.x) * scale + margin, y: (newPoint.y - bbox.y) * scale + margin }; // type 0: Line to

                var dist = Math.sqrt(Math.pow(newPoint.x - lastPoint.x, 2) + Math.pow(newPoint.y - lastPoint.y, 2));
                if (dist > sampleResolutionUnscaled*1.05) { //small multiplier for float errors
                    newPoint.type = 2;//type 2: Move to
                }
                lastPoint = newPoint;

                currentCutSeg.push(newPoint);
            }

            cutPaths.push(currentCutSeg);

            //console.log(cutPaths);
            this.setState({ cutPaths: cutPaths });

            //TODO build a more elegant solution instead of just massively sampling the SVG. See: https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/SVGLoader.js
            /*let pdata = path.getPathData();
            console.log(pdata);
            
            let currentSeg = [];
            for (const seg of pdata) {
                if (seg.type == "M") {
                    //MOVE
                } else if (seg.type == "L") {
                    //LINE
                } else if (seg.type == "H") {
                    //LINE HORIZONTAL
                } else if (seg.type == "V") {
                    //LINE VERTICAL
                } else if (seg.type == "C") {
                    //BEZIER CURVE
                } else if (seg.type == "A") {
                    //ARC
                }
            }*/
        }


        //cleanup
        div.parentNode.removeChild(div);
    }


    reformatCutPaths() {
        var out = [];
        for (const group of this.state.cutPaths) {
            for (const line of group) {
                out.push([line.type, line.x, line.y]);
            }
        }
        return out;
    }

    render() {
        var workspaceContent = this.getWorkspaceContent();
        return (
            <div className="page page-workspace">

                <div className="page-workspace-sidebar">

                    <label htmlFor="selectedDevice">Select your device</label>
                    <select value={this.state.selectedDevice} id="selectedDevice" name="selectedDevice" onChange={this.handleChange}>
                        {this.state.deviceList.map((item) =>
                            <option value={item.path} key={item.path} >{item.path}: {item.manufacturer} ({item.model})</option>
                        )}
                    </select>

                    <p><small>For Explore Air 2 set these checkboxes to "Use 0x5e Escape: True" and "Use Two-byte Lengths: False". For newer models reverse those choices. If that doesn't work, fiddle with the options and file a bug report letting me know what did or didn't work. This UI is bad and I will be fixing it as I gather more data.</small></p>

                    <label>Use 0x5e Escape <input type="checkbox" name="use0x5eEscape" checked={this.state.use0x5eEscape} onChange={this.handleChange}></input></label>

                    <label>Use Two-byte Lengths <input type="checkbox" name="useTwoByteLength" checked={this.state.useTwoByteLength} onChange={this.handleChange}></input></label>

                    <label htmlFor="selectedKey">Select AES key</label>
                    <select value={this.state.selectedKey} id="selectedKey" name="selectedKey" onChange={this.handleChange}>
                        {this.props.keys.map((item) =>
                            <option value={item} key={item}>{item}</option>
                        )}
                    </select>
                    <p><small>This UI also sucks. Try your four keys randomly until one works.</small></p>


                    <label htmlFor="width">Cut Area Width:</label>
                    <input type="number" id="width" name="width" min="1" max="48" value={this.state.width} onChange={this.handleChange} />

                    <label htmlFor="height">Cut Area Height:</label>
                    <input type="number" id="height" name="height" min="1" max="48" value={this.state.height} onChange={this.handleChange} />

                    <button onClick={this.handleSubmit}>Cut</button>
                </div>

                <div className="page-workspace-content">
                    <FileDrop onDrop={this.handleFileDrop} >
                        {workspaceContent}
                    </FileDrop>

                </div>
            </div>
        );
    }
}


