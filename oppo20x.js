let net = require('net');
let named = require('named-js-regexp');

module.exports = function (RED) {

    let queryCommands = {
        'QVM': {
            desc: 'Query verbose mode',
            mode: null,
            response: 'OK ([0-9])'
        },
        'QPW': {
            desc: 'Query power status',
            mode: 2,
            response: 'OK ([a-zA-Z]+)',
            updateResponse: 'UPW ([01])',
            convertUpdate: state => {
                "use strict";

                if (state === '1') {
                    return 'ON';
                } else if (state === '0') {
                    return 'OFF'
                }
                return null;
            }
        },
        'QVR': {
            desc: 'Query firmware version',
            mode: null,
            response: 'OK ([^\\r])'
        },
        'QVL': {
            desc: 'Query volume',
            mode: 2,
            response: 'OK ([a-zA-Z0-9]+)',
            updateResponse: 'UVL ([a-zA-Z0-9]+)',
            convertUpdate: volume => {
                "use strict";
                if (volume === 'MUT' || volume === 'UMT') return 'MUTE';
                return volume;
            }
        },
        'QHD': {
            desc: 'Query HDMI resolution',
            mode: 3,
            response: 'OK ([^\\r]+)',
            updateResponse: 'UVO ([^\\r]+)'
        },
        'QPL': {
            desc: 'Query playback status',
            mode: 2,
            response: 'OK ([a-zA-Z]+)',
            updateResponse: 'UPL ([a-zA-Z]+)'
        },
        'QTK': {
            desc: 'Query Track/Title',
            mode: null,
            response: 'OK (?<title>[0-9]+)/(?<total>[0-9]+)'
        },
        'QCH': {
            desc: 'Query Chapter',
            mode: null,
            response: 'OK (?<chapter>[0-9]+)/(?<total>[0-9]+)'
        },
        'QTE': {
            desc: 'Query Track/Title elapsed time',
            mode: 3,
            response: 'OK (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])',
            updateResponse: 'UTC (?<title>[^\ ]+) (?<chapter>[^\ ]+) E (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])'
        },
        'QTR': {
            desc: 'Query Track/Title remaining time',
            mode: 3,
            response: 'OK (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])',
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) X (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])'
        },
        'QCE': {
            desc: 'Query Chapter elapsed time',
            mode: 3,
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) C (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])'
        },
        'QCR': {
            desc: 'Query Chapter remaining time',
            mode: 3,
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) K (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])'
        },
        'QEL': {
            desc: 'Query Total elapsed time',
            mode: 3,
            response: 'OK (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])',
            updateResponse: 'UTC\ (?<title>[^\ ]+)\ (?<chapter>[^\ ]+)\ T (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])'
        },
        'QRE': {
            desc: 'Query Total remaining time',
            mode: 3,
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) R (?<time>[0-9][0-9]:[0-9][0-9]:[0-9][0-9])'
        },
        'QDT': {desc: 'Query disc type', mode: 2, updateResponse: 'UDT'},
        'QAT': {desc: 'Query audio type', mode: 2, updateResponse: 'UAT'},
        'QST': {desc: 'Query subtitle type', mode: 2, updateResponse: 'UST'},
        'QSH': {desc: 'Query subtitle shift', mode: null},
        'QOP': {desc: 'Query OSD position', mode: null},
        'QRP': {desc: 'Query Repeat Mode', mode: null},
        'QZM': {desc: 'Query Zoom Mode', mode: null},
    };

    let setCommands = {
        'SVM': {
            desc: 'set verbose mode',
            //params: '{{msg.payload}}',
            response: 'OK (\\d)',
            queryCommand: 'QVM'
        }
    };

    let updateCommands = {};
    Object.keys(queryCommands).forEach(function (key) {
        let command = queryCommands[key];

        if (command.response) {
            command.responseRegEx = named('^(?:' + key + ' )?' + command.response);
        } else {
            command.responseRegEx = named('^' + key);
        }
        if (command.updateResponse) {
            let updateResponse = command.updateResponse;
            let updateCommand = updateResponse.substr(0, 3);

            if (!updateCommands[updateCommand]) {
                updateCommands[updateCommand] = []
            }
            updateCommands[updateCommand].push({
                queryCommand: key,
                regexp: named('^' + updateResponse),
                convertUpdate: command.convertUpdate
            });
        }
    });

    Object.keys(setCommands).forEach(function (key) {
        let command = setCommands[key];

        if (command.response) {
            command.responseRegEx = named('^(?:' + key + ' )?' + command.response);
        } else {
            command.responseRegEx = named('^' + key);
        }
    });

    /**
     * ====== oppo-controller ================
     * Holds the hostname and port of the
     * openHAB server
     * ===========================================
     */
    function Oppo20xPlayerNode(config) {
        const CommandPrefix = "#";
        const AnswerPrefix = "@";

        let isPlayerConnected = false;

        let commandStack = [],
            client = null,
            reconnectCounter = 0;

        RED.nodes.createNode(this, config);

        let node = this;

        if (config.host && config.port) {
            function connectOppo(isReconnecting) {
                if (client != null) {
                    client.destroy();
                }
                client = new net.Socket();
                client.connect(parseInt(config.port), config.host, function () {
                    node.log('Connected to ' + config.host + ":" + config.port);
                    isPlayerConnected = true;
                    reconnectCounter = 0;
                    if (!isReconnecting) {
                        // update verbose mode
                        //node.queueCommand("SVM", "3");
                        node.queueCommand("QPW");

                        node.emit('Status', "CONNECTED");
                    } else {
                        node.emit('Status', "RECONNECTED");
                    }

                    setTimeout(function () {
                        node.writeToClient();
                    }, 100);
                });

                // handle the 'data' event
                client.on('data', function (data) {
                    node.log('receive ' + data.toString());
                    let answer = data.toString();
                    if (answer.startsWith(AnswerPrefix)) {
                        // remove prefix
                        answer = answer.substr(AnswerPrefix.length);
                        if (commandStack.length > 0) {
                            let lastCommand = commandStack[0];
                            if (queryCommands[lastCommand.name]) {
                                let matched = answer.match(queryCommands[lastCommand.name].responseRegEx);

                                if (matched) {
                                    commandStack.shift();
                                    if (Object.keys(matched.groups()).length > 0) { // names groups
                                        node.emit(
                                            lastCommand.name,
                                            matched.groups()
                                        )
                                    } else {
                                        node.emit(
                                            lastCommand.name,
                                            matched[1]
                                        )
                                    }
                                } else if (answer.startsWith(lastCommand.name + ' ER') || answer.startsWith('ER')) {
                                    // top command received
                                    commandStack.shift();
                                }
                            } else if (setCommands[lastCommand.name]) {
                                let matched = answer.match(setCommands[lastCommand.name].responseRegEx);

                                if (matched) {
                                    commandStack.shift();
                                    if (Object.keys(matched.groups()).length > 0) { // names groups
                                        node.emit(
                                            setCommands[lastCommand.name].queryCommand,
                                            matched.groups()
                                        )
                                    } else {
                                        node.emit(
                                            setCommands[lastCommand.name].queryCommand,
                                            matched[1]
                                        )
                                    }
                                } else if (answer.startsWith(lastCommand.name + ' ER') || answer.startsWith('ER')) {
                                    // top command received
                                    commandStack.shift();
                                }
                            } else {
                                // just kick first command
                                commandStack.shift();
                            }
                        } else {
                            // handle unrequested input
                            if (answer.startsWith('U')) { // receive update response
                                let updateCommand = answer.substr(0, 3);
                                if (updateCommands[updateCommand]) {
                                    // try to match response
                                    for (let i = 0; i < updateCommands[updateCommand].length; i++) {

                                        let matched = answer.match(updateCommands[updateCommand][i].regexp);
                                        if (!matched) continue;

                                        let convertUpdate = updateCommands[updateCommand][i].convertUpdate || (data => data);

                                        if (Object.keys(matched.groups()).length > 0) { // names groups
                                            node.emit(
                                                updateCommands[updateCommand][i].queryCommand,
                                                convertUpdate(matched.groups())
                                            )
                                        } else {
                                            node.emit(
                                                updateCommands[updateCommand][i].queryCommand,
                                                convertUpdate(matched[1])
                                            )
                                        }

                                        break;
                                    }
                                }
                            }
                        }

                        setTimeout(function () {
                            node.writeToClient();
                        }, 100);

                    }
                });

                client.on('close', function (had_error) {
                    node.log("connection Close");
                    isPlayerConnected = false;
                    node.emit('Status', {state: "DISCONNECTED"});
                    if (client != null) {
                        client.destroy();
                        client = null;
                        commandStack = [];
                        reconnectCounter++;

                        setTimeout(function () {
                            node.emit('Status', {state: "RECONNECTING"});
                            connectOppo(true);
                        }, 10000 + 5000*reconnectCounter);
                    }
                });

                // handle the 'onerror' event
                client.on('error', function (err) {
                    if (err.type && (JSON.stringify(err.type) === '{}'))
                        return; // ignore

                    node.warn('ERROR ' + JSON.stringify(err));
                    node.emit('Error', JSON.stringify(err));
                });
            }

            // give the system few seconds
            setTimeout(function () {
                connectOppo(false);
            }, 1000);
        }

        node.queueCommand = function (cmd, param) {
            "use strict";
            node.log("queing " + cmd);
            node.log(JSON.stringify(commandStack));

            param = param || null;
            let now = Date.now();
            commandStack.push({
                'name': cmd,
                'parameter': param,
                'timestamp': now
            });

            // remove first commands if older than 10sec
            // improve this
            node.log("check ");
            if (commandStack.length > 0 && commandStack[0].timestamp + 10000 < now) {
                commandStack.shift();
            }
            node.log("check end");
            node.writeToClient();
        };

        node.writeToClient = function () {
            if (commandStack.length >= 1 && isPlayerConnected) {
                let command = commandStack[0];
                node.log("sending " + CommandPrefix + command.name + (command.parameter !== null ? ' ' + command.parameter : ''));
                client.write(CommandPrefix + command.name + (command.parameter !== null ? ' ' + command.parameter : '') + "\r\n");
            }
        };

        node.on("close", function () {
            node.log('closing oppo');
            commandStack = [];
            if (client != null) {
                client.destroy();
                client = null;
            }
            isPlayerConnected = false;
            reconnectCounter = 0;
        });
    }

    RED.nodes.registerType("OPPO UDP 20x player", Oppo20xPlayerNode);


    /**
     * ====== oppo20x-in ========================
     * Handles incoming oppo events, injecting
     * json into node-red flows
     * ===========================================
     */
    function OppoInNode(config) {

        RED.nodes.createNode(this, config);
        this.name = config.name;
        let node = this;
        let oppoplayer = RED.nodes.getNode(config.player);
        let itemName = config.itemname;

        if (itemName !== undefined) itemName = itemName.trim();

        node.refreshNodeStatus = function () {
            let currentState = node.context().get("currentState") || null;
            let currentStatus = node.context().get("currentStatus");
            let color = null;
            let shape = null;
            switch (currentStatus) {
                case 'CONNECTED':
                case 'OFF':
                    color = 'green';
                    shape = 'ring';
                    break;
                case 'ON':
                    color = 'green';
                    shape = 'dot';
                    break;
                case 'DISCONNECTED':
                    color = 'gray';
                    shape = 'dot';
                    break;
                case 'RECONNECTING':
                    color = 'yellow';
                    shape = 'ring';
                    break;
                default:
                    color = 'gray';
                    shape = 'dot';
            }

            if (currentState === '?' || currentState === null )
                node.status({fill: color, shape: shape, text: "state: unknown"});
            else
                node.status({
                    fill: color,
                    shape: shape,
                    text: "state: " + (typeof currentState === 'object' ? JSON.stringify(currentState) : currentState)
                });
        };

        node.processStatusEvent = function (event) {
            "use strict";

            node.log("status " + JSON.stringify(event));
            node.context().set("currentStatus", event);

            if (event === 'CONNECTED') { // successfully connected
                if (queryCommands[itemName]) { // valid command
                    oppoplayer.queueCommand(itemName);
                } else {
                    node.log('invalid query commend ' + itemName);
                }
            }

            // update node's visual status
            node.refreshNodeStatus();
        };
        node.processStateEvent = function (event) {
            "use strict";

            let currentState = node.context().get("currentState");

            if ((event !== currentState) && (event !== null)) {
                // update node's context variable
                currentState = event;
                node.context().set("currentState", currentState);

                // update node's visual status
                node.refreshNodeStatus();

                // inject the state in the node-red flow
                let msgid = RED.util.generateId();
                node.send({_msgid: msgid, payload: currentState, item: itemName, event: "StateEvent"});
            }
        };

        node.context().set("currentState", "?");
        node.context().set("currentStatus", "DISCONNECTED");
        oppoplayer.addListener(itemName, node.processStateEvent);
        oppoplayer.addListener("Status", node.processStatusEvent);
        node.refreshNodeStatus();

        /* ===== Node-Red events ===== */
        node.on("input", function (msg) {
            if (msg != null) {
                oppoplayer.queueCommand(itemName);
            }
        });
        node.on("close", function () {
            oppoplayer.removeListener(itemName, node.processStateEvent);
            oppoplayer.removeListener("Status", node.processStatusEvent);
        });
    }

    //
    RED.nodes.registerType("OPPO UDP 20x-in", OppoInNode);

    function OppoOutNode(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        let node = this;
        let oppoplayer = RED.nodes.getNode(config.player);
        let itemName = config.itemname;

        if (itemName !== undefined) itemName = itemName.trim();

        this.processStateEvent = function (event) {

            let currentState = node.context().get("currentState");

            if ((event.state !== currentState) && (event.state != null)) {
                // update node's context variable
                currentState = event.state;
                node.context().set("currentState", currentState);

                // update node's visual status
                //node.refreshNodeStatus();

                // inject the state in the node-red flow
                let msgid = RED.util.generateId();
                node.send([{_msgid: msgid, payload: currentState, item: itemName, event: "StateEvent"}, null]);
            }
        };

        node.context().set("currentState", "?");
        oppoplayer.addListener(itemName, node.processStateEvent);
        //node.refreshNodeStatus();

        /* ===== Node-Red events ===== */
        this.on("input", function (msg) {
            if (msg != null) {
                oppoplayer.queueCommand(itemName);//, msg.payload);
            }
        });
        this.on("close", function () {
            node.log('close');
            oppoplayer.removeListener(itemName, node.processStateEvent);
        });

    }

    //
    RED.nodes.registerType("OPPO UDP 20x-out", OppoOutNode);
    /**
     * Start auto detection of OPPO 10x and 20x players
     */
    /*
        let players = {},
            oppo20xDetect = dgram.createSocket('udp4');

        oppo20xDetect.on('close', function () {
            RED.log.info("Closed");
        });

        oppo20xDetect.on('error', (err) => {
            RED.log.error('OPPO discovering server error:\n${err.stack}');
            oppo20xDetect.close();
        });

        oppo20xDetect.on('message', function (msg, rinfo) {

            let content = msg.toString();

            // checking for OPPO Header
            if (content.startsWith('Notify:OPPO Player Start')) {
                let lines = content.split('\n');
                let ip = lines[1].split(':')[1] || "";

                if (ip !== "" && typeof players[ip] === 'undefined') {
                    let playerName;
                    if (lines.length > 3) { // OPPO 10x dosn't submit player name
                        playerName = lines[3].split(':')[1];
                    } else {
                        playerName = "OPPO 10x (" + ip + ")"
                    }
                    ;

                    let newPlayer = players[ip] = {
                        'host': ip,
                        'port': lines[2].split(':')[1],
                        'name': playerName
                    };
                    RED.nodes.putNode(new Oppo20xPlayerNode(newPlayer));
                    RED.log.info(new Oppo20xPlayerNode(newPlayer));
                    RED.log.info("Found OPPO \"" + newPlayer.name + "\" at " + newPlayer.host + ":" + newPlayer.port);
                }
            }
        });

        oppo20xDetect.on('listening', function () {
            oppo20xDetect.setBroadcast(true);
            RED.log.info('OPPO auto discovering started');
        });

        oppo20xDetect.bind(7624);

        // start a web service for enabling the node configuration ui to query for available OPPO players
        RED.httpNode.get("/oppo/players", function (req, res, next) {
            RED.log.info(players);
            res.send(players);
        });
    */
};
