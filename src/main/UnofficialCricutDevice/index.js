const EventEmitter = require('events').EventEmitter;
const SerialPort = require('serialport');
const crypto = require('crypto');


var log = console.log;
var verbose = log;

const opcodes = [
    {
        name: "BeginCut",
        opcode: "21",
        args: [
            {
                type: "fixed",
                value: "000000"
            }
        ],
        handler: OKResponseHandler
    },
    {
        name: "EndCut",
        opcode: "22",
        args: [
            {
                type: "fixed",
                value: "000000"
            }
        ],
        handler: OKResponseHandler
    },
    {
        name: "Move",
        opcode: "43",
        args: [
            //this is actually wrong, you can send many of these args concatenated i.e., type1,x1,type2,x2,y2,type3,x3,y3, etc. 
            //But just sending one at a time works. It's a bit janky and incurs more overhead, but it works.
            //TODO FIXME maybe??
            {
                name: "type",
                type: "uInt8"
            },
            {
                name: "x",
                type: "floatLE"
            },
            {
                name: "y",
                type: "floatLE"
            }
        ],
        handler: OKResponseHandler
    },
    {
        name: "PreHandshake",
        opcode: "E5",
        fixedLength: 64,
        args: []
    },
    {
        name: "SeedRandom",
        opcode: "CF",
        args: [
            {
                type: "random",
                count: 3
            }
        ]
    },
    {
        name: "ClearErrors",
        opcode: "0A",
    },
    {
        name: "NewAES",
        opcode: "C7",
        args: [
            {
                type: "random",
                count: 48
            }
        ]
    },
    {
        name: "GetStatus",
        opcode: "60",
        args: [
            {
                type: "fixed",
                value: "000000"
            }
        ],
        handler: function (data) {
            if (data[0] != 0x60) {
                throw ('Status sent back non-status data');
            }
            var out = {
                unknown1: ((data[1] >> 0) & 1),
                notMoving: ((data[1] >> 1) & 1),
                unknown3: ((data[1] >> 2) & 1),
                unknown4: ((data[1] >> 3) & 1),
                unknown5: ((data[1] >> 4) & 1),
                unknown6: ((data[1] >> 5) & 1),
                unknown7: ((data[1] >> 6) & 1),
                unknown8: ((data[1] >> 7) & 1),
                materialLoaded: ((data[2] >> 0) & 1),
                unknown10: ((data[2] >> 1) & 1),
                unknown11: ((data[2] >> 2) & 1),
                unknown12: ((data[2] >> 3) & 1),
                unknown13: ((data[2] >> 4) & 1),
            };
            return out;
        }
    },
    { //TODO is this required?
        name: "UnknownSet74",
        opcode: "74"
    },
    { //unknown, echoes back a slightly changed version of itself. //TODO is this required?
        name: "Unknown30",
        opcode: "30",
        args: [
            {
                name: "value",
                type: "hex" //I saw 30280000040403e803e8000087 used
            }
        ]
    },
    { //randomly tweaking some values seems to change speeds. Hard to say what values to what.
        name: "SetSpeedsAndFeeds",
        opcode: "31",
        args: [
            {
                name: "value",
                type: "hex" //My machine uses 400000003ecccccd400000003ecccccd40400000421a666640400000421a6666 TODO figure out what the exact values here do.
            }
        ]
    },
];

function OKResponseHandler(data) {
    var out = {};
    //common handler used by several commands
    if (data[0] == 0) {
        //device is OK
        out.OK = true;
    } else if (data[0] == 1) {
        //device is NOT OK
        out.OK = false;
    } else {
        throw (`Unknown response (expected OK/NOT OK) ${data[0]}`);
    }
    out.queueLength = data[4];
    console.log(out.OK, out.queueLength);
    return out;
}

function randomChars(count) {
    if (!count) {
        count = 1;
    }
    var out = [];
    for (let i = 0; i < count; i++) {
        out.push(Math.floor(Math.random() * 256));

    }
    return out;
}


function ListDevices() {
    return SerialPort.list().then(function (data) {
        for (const serialConnection of data) {
            serialConnection.isValidCutterDevice = false;
            serialConnection.model = "Unknown";

            if (
                (serialConnection.manufacturer && (serialConnection.manufacturer.includes("Provo") || serialConnection.manufacturer.includes("Cricut"))) ||
                (serialConnection.vendorId && serialConnection.vendorId.includes("20D3"))
            ) {
                serialConnection.isValidCutterDevice = true;
                serialConnection.cutterModel = `Cutting Device ${serialConnection.productId}`;
                if (serialConnection.productId == "0022") {
                    serialConnection.model = "Explore Air 2";
                }
            }
        }
        return data;
    });
}


class UnofficialCricutDevice extends EventEmitter {
    constructor(serialPath, options) {
        super();
        if (!options) options = {};
        
        this.messageResponsePromises = [];
        this.waitingSerialData = Buffer.alloc(0);

        log = options.log ? options.log : console.log;
        verbose = options.verbose ? function(msg){log(msg);} : function(){};
        this.key = Buffer.from(options.key, "hex");

        this.use0x5eEscape = options.use0x5eEscape;
        this.useTwoByteLength = options.useTwoByteLength;

        this.size = { width: options.width || 12, height: options.height || 12 };

        if (serialPath != -1) {
            this.serialConnection = new SerialPort(serialPath);
            this.serialConnection.on('data', buf => this.onSerial(buf));
        } else {
            log("Skipping serial connection, I hope you know what you're doing.");
        }

        log("Done constructor");
    }
    parseMessageLength(msg) {
        if (this.useTwoByteLength) {
            if (msg.length < 2) return null;
            let msgLen = ((msg[0] & 0x7F) << 8) | (msg[1]); //ignore highest bit, which is the cypher flag
            if (msg.length < msgLen + 2) return null;
            return msgLen + 2;
        } else {
            if (msg.length < 1) return null;
            let msgLen = (msg[0] & 0x7F); //ignore highest bit, which is the cypher flag
            if (msg.length < msgLen + 1) return null;
            return msgLen + 1;
        }
    }
    decypherMsgIfApplicable(message) {
        if (this.useTwoByteLength) {

            var length = message.readUInt16BE(0);
            if ((length & 0x8000) == 0) {
                return message;
            } else {
                length &= 0x7FFF; // this unsets the encryption flag byte
                let decyphered = this.decypherMsg(message.slice(2, 2 + length), this.sessionKey);
                decyphered = decyphered.slice(2, decyphered[0] + 2); //MAY BE BROKEN
                return decyphered;
            }

        } else {

            var length = message.readUInt8(0);
            if ((length & 0x80) == 0) {
                return message;
            } else {
                length &= 0x7F; // this unsets the encryption flag byte
                let decyphered = this.decypherMsg(message.slice(1, 1 + length), this.sessionKey);
                decyphered = decyphered.slice(1, decyphered[0] + 1)
                return decyphered;
            }

        }
    }
    onSerial(newData) {
        this.waitingSerialData = Buffer.concat([this.waitingSerialData, newData]);
        while (true) {
            let packetLen = this.parseMessageLength(this.waitingSerialData);
            if (packetLen == null) {
                return;
            }

            let received = this.waitingSerialData.slice(0, packetLen);
            received = this.decypherMsgIfApplicable(received);
            verbose(`Received ${received.toString('hex')}`);
            this.messageResponsePromises.shift()(received);

            this.waitingSerialData = this.waitingSerialData.slice(packetLen);
        }
    }
    serialWriteRequest(data) {
        return new Promise(fulfill => {
            this.serialConnection.write(data);
            this.messageResponsePromises.push(fulfill);
            //verbose(`Sent: ${data.toString('hex')}`);
        });
    }
    constructRequest(name, argValues) {
        const command = opcodes.find(el => el.name == name);
        if (!command) {
            throw (`Invalid command name: ${name}.`);
        }
        var data = Buffer.from(command.opcode, 'hex');

        let args = command.args || [];
        //TODO not very DRY in here
        for (const arg of args) {
            switch (arg.type) {
                case "fixed":
                    data = Buffer.concat([data, Buffer.from(arg.value, 'hex')]);
                    break;
                case "random":
                    data = Buffer.concat([data, Buffer.from(randomChars(arg.count))]);
                    break;
                case "uInt8":
                    if (arg.name in argValues) {
                        let buf = Buffer.alloc(1);
                        buf.writeUInt8(argValues[arg.name]);
                        data = Buffer.concat([data, buf]);
                    } else {
                        throw (`Missing value for arg: ${arg.name}.`);
                    }
                    break;
                case "uInt16BE":
                    if (arg.name in argValues) {
                        let buf = Buffer.alloc(2);
                        buf.writeUInt16BE(argValues[arg.name]);
                        data = Buffer.concat([data, buf]);
                    } else {
                        throw (`Missing value for arg: ${arg.name}.`);
                    }
                    break;
                case "uInt32LE":
                    if (arg.name in argValues) {
                        let buf = Buffer.alloc(4);
                        buf.writeUInt16LE(argValues[arg.name]);
                        data = Buffer.concat([data, buf]);
                    } else {
                        throw (`Missing value for arg: ${arg.name}.`);
                    }
                    break;
                case "floatLE":
                    if (arg.name in argValues) {
                        let buf = Buffer.alloc(4);
                        buf.writeFloatLE(argValues[arg.name]);
                        data = Buffer.concat([data, buf]);
                    } else {
                        throw (`Missing value for arg: ${arg.name}.`);
                    }
                    break;
                case "hex":
                    if (arg.name in argValues) {
                        let buf = Buffer.from(argValues[arg.name], "hex");
                        data = Buffer.concat([data, buf]);
                    } else {
                        throw (`Missing value for arg: ${arg.name}.`);
                    }
                    break;
                default:
                    throw (`Invalid arg type: ${arg.type}.`);
            }
        }

        if (command.fixedLength) {
            var lengthRoom = this.useTwoByteLength ? 2 : 1;
            let buf = Buffer.alloc(command.fixedLength - lengthRoom - data.length);
            buf.fill(0);
            data = Buffer.concat([data, buf]);
        }

        let length;
        if (this.useTwoByteLength) {
            length = Buffer.alloc(2);
            length.writeUInt16BE(data.length);
        } else {
            length = Buffer.alloc(1);
            length.writeUInt8(data.length);
        }

        data = Buffer.concat([length, data]);
        return data;
    }
    getResponseHandler(name) {
        const command = opcodes.find(el => el.name == name);
        if (!command) {
            throw (`Invalid command name: ${name}.`);
        }
        if (!command.handler) {
            return function (d) { return d }; //noop
        } else {
            return command.handler;
        }
    }
    sendPlainRequest(name, argValues) {
        var data = this.constructRequest(name, argValues);
        verbose(`Sending ${name}: ${data.toString('hex')}`);
        return this.serialWriteRequest(data).then(this.getResponseHandler(name));
    }
    sendCypheredRequest(name, argValues) {
        var data = this.constructRequest(name, argValues);
        let padding = Buffer.alloc(16 - ((data.length + 1) % 16), 0); // Amount of data leftover after the 16 byte sections. 0-15 bytes left over filled with 0s
        let checksum = Buffer.alloc(1, data.reduce((a, b) => a + b) & 0xFF);
        let toEncrypt = Buffer.concat([data, padding, checksum]);
        verbose(`Sending Encrypted ${name}: ${toEncrypt.toString('hex')}`);

        let cipher = crypto.createCipheriv('aes-256-ecb', this.sessionKey, '');
        cipher.setAutoPadding(false);
        let cyphered = Buffer.concat([cipher.update(toEncrypt), cipher.final()]);

        let length;
        if (this.useTwoByteLength) {
            length = Buffer.alloc(2);
            length.writeUInt16BE(toEncrypt.length, 0);
        } else {
            length = Buffer.alloc(1);
            length.writeUInt8(toEncrypt.length, 0);
        }
        length[0] |= 0x80; //set highest bit to indicate cyphered message

        return this.serialWriteRequest(Buffer.concat([length, cyphered])).then(this.getResponseHandler(name));
    }
    decypherMsg(message, key) {
        let decipher = crypto.createDecipheriv('aes-256-ecb', key, '').setAutoPadding(false);
        return Buffer.concat([decipher.update(message), decipher.final()]);
    }
    async handshake() {
        log(`Starting handshake.`);
        this.emit('statusChange', "handshaking");
        await this.sendPlainRequest("PreHandshake");
        verbose(`Done PreHandshake.`);
        await this.sendPlainRequest("SeedRandom");
        verbose(`Done SeedRandom.`);
        await this.sendPlainRequest("ClearErrors");
        verbose(`Done ClearErrors.`);

        var AESVal = await this.sendPlainRequest("NewAES");
        verbose(`Done NewAES.`);

        AESVal = this.decypherMsg(AESVal.slice(this.useTwoByteLength ? 2 : 1), Buffer.from(this.key, 'hex'));
        verbose(`Got encryption setup data: ${AESVal.toString('hex')}`);

        this.sessionKey = AESVal.slice(AESVal[0], AESVal[0] + 32);
        if (this.sessionKey.length != 32) {
            throw (`Got invalid session key length: ${this.sessionKey.length}`)
        }
        verbose(`Got session key: ${this.sessionKey.toString('hex')}`);
        this.emit('statusChange', "ready");
    }

    async waitForDoneMoving() {
        var moving = true;
        while (moving) {
            console.log("waitForDoneMoving");
            moving = !(await this.sendCypheredRequest("GetStatus")).notMoving;
            await new Promise(r => setTimeout(r, 200)); //delay
        }
        return;
    }

    async draw(segments) {
        if (!segments) {
            throw ("No segments sent to draw command");
        }
        //segments is array of arrays. Each of the sub arrays is [type, xpos, ypos]
        //type is 0:cut or 2:move I think
        //X Y is in inches?

        log('Waiting for paper load...');
        var materialLoaded = false;
        this.emit('statusChange', "waitingForMaterial");
        while (!materialLoaded) {
            verbose("Waiting for material...")
            await new Promise(r => setTimeout(r, 200)); //delay
            materialLoaded = (await this.sendCypheredRequest("GetStatus")).materialLoaded;
        }
        this.emit('statusChange', "cutting");

        await this.sendCypheredRequest("EndCut"); //seems to be done for safety


        await this.sendCypheredRequest("UnknownSet74");
        await this.sendCypheredRequest("Unknown30", {
            value: "280000040403e803e8000087"
        });
        await this.sendCypheredRequest("SetSpeedsAndFeeds", {
            value: "400000003ecccccd400000003ecccccd40400000421a666640400000421a6666"
        });


        let queueSpaceAvailable;
        while (segments.length > 0) {
            var res = await this.sendCypheredRequest("BeginCut");
            queueSpaceAvailable = res.queueLength;
            while (queueSpaceAvailable > 1) {
                let currentSeg = segments.shift();
                if (!currentSeg) {
                    break; //probably out of segs
                }
                res = await this.sendCypheredRequest("Move", {
                    x: currentSeg[1],
                    y: currentSeg[2],
                    type: currentSeg[0],
                });
                queueSpaceAvailable = res.queueLength;
            }

            res = await this.sendCypheredRequest("EndCut");
            queueSpaceAvailable = res.queueLength;

            await this.waitForDoneMoving();
        }
        this.emit('statusChange', "done");

        return;

    }
    async unload() {
        await this.sendCypheredRequest("EndCut"); //safety

        var materialLoaded = true;
        while (materialLoaded) {
            verbose("Waiting for material unload...")
            await new Promise(r => setTimeout(r, 200)); //delay
            materialLoaded = (await this.sendCypheredRequest("GetStatus")).materialLoaded;
        }
    }
}


module.exports = { UnofficialCricutDevice, ListDevices, opcodes };
