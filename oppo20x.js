"use strict";

let net = require('net');
let named = require('named-js-regexp');

module.exports = function (RED) {

    let parseTime = (player, data) => {
            "use strict";
            data.h = parseInt(data.h);
            data.s = parseInt(data.s);
            data.m = parseInt(data.m);
            data.seconds = data.s + data.m*60 + data.h*3600;

            return data;
        };
    let queryCommands = {
        'QVM': {
            desc: 'Query verbose mode',
            mode: null,
            response: '(?:QVM )?OK ([0-9])'
        },
        'QPW': {
            desc: 'Query power status',
            mode: 2,
            response: '(?:QPW )?OK ([a-zA-Z]+)',
            handle: (player, state) => {

                player.setOnline(state === 'ON' || state === '1');

                if (state === '1') {
                    return 'ON';
                } else if (state === '0') {
                    return 'OFF'
                }
                return state;
            },
            updateResponse: 'UPW ([01])'
        },
        'QVR': {
            desc: 'Query firmware version',
            mode: null,
            response: '(?:QVR )?OK ([a-zA-Z0-9 \-]+)'
        },
        'QVL': {
            desc: 'Query volume',
            mode: 2,
            response: '(?:QVL )?OK ([a-zA-Z0-9]+)',
            updateResponse: 'UVL ([a-zA-Z0-9]+)',
            handle: (player, volume) => {
                "use strict";
                if (volume === 'MUT' || volume === 'UMT') return 'MUTE';
                return volume;
            }
        },
        'QHD': {
            desc: 'Query HDMI resolution',
            mode: 3,
            response: '(?:QHD )?OK ([a-zA-Z\ ]+)',
            updateResponse: 'UVO ([^\\r]+)'
        },
        'QPL': {
            desc: 'Query playback status',
            mode: 2,
            response: '(?:QPL )?OK ([a-zA-Z ]+)',
            updateResponse: 'UPL ([a-zA-Z ]+)'
        },
        'QTK': {
            desc: 'Query Track/Title',
            mode: null,
            response: '(?:QTK )?OK (?<title>[0-9]+)/(?<total>[0-9]+)'
        },
        'QCH': {
            desc: 'Query Chapter',
            mode: null,
            response: '(?:QCH )?OK (?<chapter>[0-9]+)/(?<total>[0-9]+)'
        },
        'QTE': {
            desc: 'Query Track/Title elapsed time',
            mode: 3,
            response: '(?:QTE )?OK (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            updateResponse: 'UTC (?<title>[^\ ]+) (?<chapter>[^\ ]+) E (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            handle: parseTime,
            getNodeState: (state) => state.time
        },
        'QTR': {
            desc: 'Query Track/Title remaining time',
            mode: 3,
            response: '(?:QTR )?OK (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) X (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            handle: parseTime,
            getNodeState: (state) => state.time
        },
        'QCE': {
            desc: 'Query Chapter elapsed time',
            mode: 3,
            response: '(?:QCE )?OK (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) C (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            handle: parseTime,
            getNodeState: (state) => state.time
        },
        'QCR': {
            desc: 'Query Chapter remaining time',
            mode: 3,
            response: '(?:QCR )?OK (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) K (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            handle: parseTime,
            getNodeState: (state) => state.time
        },
        'QEL': {
            desc: 'Query Total elapsed time',
            mode: 3,
            response: '(?:QEL )?OK (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            updateResponse: 'UTC\ (?<title>[^\ ]+)\ (?<chapter>[^\ ]+)\ T (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            handle: parseTime,
            getNodeState: (state) => state.time
        },
        'QRE': {
            desc: 'Query Total remaining time',
            mode: 3,
            response: '(?:QRE )?OK (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            updateResponse: 'UTC (?<title>[^ ]+) (?<chapter>[^ ]+) R (?<time>(?<h>[0-9][0-9]):(?<m>[0-9][0-9]):(?<s>[0-9][0-9]))',
            handle: parseTime,
            getNodeState: (state) => state.time
        },
        'QDT': {
            desc: 'Query disc type',
            mode: 2,
            response: '(?:QDT )?OK ([a-zA-Z \-]+)',
            updateResponse: 'UDT'},
        'QAT': {
            desc: 'Query audio type',
            mode: 2,
            response: '(?:QAT )?OK (?<type>[^ ]+) (?<track>[0-9]+)/(?<total>[0-9]+)(?: (?<language>[A-Za-z]*))',
            updateResponse: 'UAT'},
        'QST': {
            desc: 'Query subtitle type',
            mode: 2,
            response: '(?:QST )?OK ([a-zA-Z \-]+)',
            updateResponse: 'UST'},
        'QSH': {
            desc: 'Query subtitle shift',
            mode: null,
            response: '(?:QSH )?OK ([0-9\-]+)'},
        'QOP': {
            desc: 'Query OSD position',
            mode: null,
            response: '(?:QOP )?OK ([0-5]+)'},
        'QRP': {desc: 'Query Repeat Mode', mode: null,
            response: '(?:QRP )?OK (?<number>[0-5][0-5]) (?<text>[A-Za-z \-]+)'},
        'QZM': {desc: 'Query Zoom Mode', mode: null,
            response: '(?:QZM )?OK (?<number>[0-5][0-5]) (?<text>[A-Za-z \-]+)'},
    };

    let setCommands = {
        'SVM': {
            desc: 'set verbose mode',
            hasParameter: true,
            response: '(?:SVM )?OK (\\d)',
            queryCommand: 'QVM'
        },
        'POW': {
            desc: 'power player on',
            hasParameter: false,
            response: '(?:POW )?OK ([a-zA-Z]+)',
            queryCommand: 'QPW'
        },
        'PON': {
            desc: 'Discrete on',
            hasParameter: false,
            response: 'OK (ON)',
            queryCommand: 'QPW'
        },
        'POF': {
            desc: 'Discrete off',
            hasParameter: false,
            response: 'OK (OFF)',
            queryCommand: 'QPW'
        }
    };

    let updateCommands = {};

    Object.keys(queryCommands).forEach(function (key) {
        let command = queryCommands[key];

        if (command.response) {
            command.responseRegEx = named('^' + command.response);
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
                handle: command.handle
            });
        }
    });

    Object.keys(setCommands).forEach(function (key) {
        let command = setCommands[key];

        if (command.response) {
            command.responseRegEx = named('^' + command.response);
        } else {
            command.responseRegEx = named('^OK');
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

        let isPlayerConnected = false,
            isPlayerOnline = false;

        let commandStack = [],
            client = null,
            reconnectCounter = 0;

        RED.nodes.createNode(this, config);

        let node = this;
        if (config.host && config.port) {

            // give the system few seconds
            setTimeout(function () {
                connectOppo(false);
            }, 1000);
        }

        node.queueCommand = function (cmd, param) {
            "use strict";
            let now = Date.now();
            if (node.isPlayerOnline || cmd === 'QPW' || cmd === 'POW' || cmd === 'PON' ) {
                RED.log.trace("queing " + cmd);

                param = param || null;
                commandStack.push({
                    'name': cmd,
                    'parameter': param,
                    'timestamp': null
                });

                // remove first commands if older than 2sec
                // improve this
                if (commandStack.length > 0 && commandStack[0].timestamp !== null && commandStack[0].timestamp + 2000 < now) {
                    commandStack.shift();
                }
                RED.log.trace("queue is: " + JSON.stringify(commandStack));

            }

            node.writeToClient();
        };

        node.writeToClient = function () {
            if (commandStack.length >= 1 && isPlayerConnected) {
                let command = commandStack[0];
                if (command.timestamp === null) {
                    // command not send
                    command.timestamp = Date.now();
                    RED.log.trace("sending " + CommandPrefix + command.name + (command.parameter !== null ? ' ' + command.parameter : ''));
                    client.write(CommandPrefix + command.name + (command.parameter !== null ? ' ' + command.parameter : '') + "\r\n");
                }
            }
        };

        node.setOnline = function(isPlayerOnline) {
            if (this.isPlayerOnline !== isPlayerOnline) {
                this.isPlayerOnline = isPlayerOnline;
                if (isPlayerOnline) {
                    // enable verbose mode
                    let node = this;

                    setTimeout(() => {
                        node.queueCommand('SVM', '3');
                        node.emit('PlayerStatus', 'ON');
                    }, 3000);
                } else {
                    this.emit('PlayerStatus', 'OFF');
                }
            }
        };

        node.on("close", function () {
            RED.log.trace('closing oppo');
            commandStack = [];
            if (client != null) {
                client.end();
                client.destroy();
                client = null;
            }
            isPlayerConnected = false;
            reconnectCounter = 0;
        });

        node.setMaxListeners(0);

        function connectOppo(isReconnecting) {
            if (client != null) {
                client.end();
                client.destroy();
            }
            client = new net.Socket();
            client.connect(parseInt(config.port), config.host, function () {
                RED.log.trace('Connected to ' + config.host + ":" + config.port);
                isPlayerConnected = true;
                reconnectCounter = 0;

                node.queueCommand('QPW');
                node.emit('PlayerStatus', 'CONNECTED');

                setTimeout(function () {
                    node.writeToClient();
                }, 1000);
            });

            // handle the 'data' event
            client.on('data', function (data) {
                RED.log.debug('receive ' + data.toString());
                // we may have multiple answers received -> split them
                let answers = data.toString().split(AnswerPrefix);
                answers.shift(); // remove first empty element

                while (answers.length > 0) {
                    // remove prefix
                    let answer = answers.shift();
                    if (answer.startsWith('U')) { // receive update response
                        let updateCommand = answer.substr(0, 3);
                        if (updateCommands[updateCommand]) {
                            // try to match response
                            for (let i = 0; i < updateCommands[updateCommand].length; i++) {

                                let matched = answer.match(updateCommands[updateCommand][i].regexp);
                                if (!matched) continue;

                                let handle = updateCommands[updateCommand][i].handle || ((node, data) => data);

                                if (Object.keys(matched.groups()).length > 0) { // names groups
                                    node.emit(
                                        updateCommands[updateCommand][i].queryCommand,
                                        handle(node, matched.groups())
                                    )
                                } else {
                                    node.emit(
                                        updateCommands[updateCommand][i].queryCommand,
                                        handle(node, matched[1])
                                    )
                                }

                                break;
                            }
                        }
                    } else {
                        if (commandStack.length > 0) {
                            let lastCommand = commandStack[0];
                            if (queryCommands[lastCommand.name]) {
                                let matched = answer.match(queryCommands[lastCommand.name].responseRegEx);

                                if (matched) {

                                    commandStack.shift();
                                    if (Object.keys(matched.groups()).length > 0) { // names groups
                                        if (queryCommands[lastCommand.name].handle) {
                                            queryCommands[lastCommand.name].handle(node, matched.groups());
                                        }
                                        node.emit(
                                            lastCommand.name,
                                            matched.groups()
                                        )
                                    } else {
                                        if (queryCommands[lastCommand.name].handle) {
                                            queryCommands[lastCommand.name].handle(node, matched[1]);
                                        }
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
                                    if (setCommands[lastCommand.name].queryCommand) { // Command has the posibility to be queried -> inform input nodes
                                        if (Object.keys(matched.groups()).length > 0) { // names groups
                                            if (queryCommands[setCommands[lastCommand.name].queryCommand].handle) {
                                                queryCommands[setCommands[lastCommand.name].queryCommand].handle(node, matched.groups());
                                            }
                                            node.emit(
                                                setCommands[lastCommand.name].queryCommand,
                                                matched.groups()
                                            )
                                        } else {
                                            if (queryCommands[setCommands[lastCommand.name].queryCommand].handle) {
                                                queryCommands[setCommands[lastCommand.name].queryCommand].handle(node, matched[1]);
                                            }
                                            node.emit(
                                                setCommands[lastCommand.name].queryCommand,
                                                matched[1]
                                            )
                                        }
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

                        }
                    }
                }

                setTimeout(function () {
                    node.writeToClient();
                }, 100);
            });

            client.on('close', function (had_error) {
                RED.log.trace("connection Close");
                isPlayerConnected = false;
                node.emit('PlayerStatus', "DISCONNECTED");
                if (client != null) {
                    client.destroy();
                    client = null;
                    commandStack = [];
                    reconnectCounter++;

                    setTimeout(function () {
                        node.emit('PlayerStatus', "RECONNECTING");
                        connectOppo(true);
                    }, 10000 + 5000*Math.min(10, reconnectCounter));
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
    }

    RED.nodes.registerType("OPPO UDP 20x player", Oppo20xPlayerNode);

    /**
     * ====== oppo20x-in ========================
     * Handles incoming oppo events, injecting
     * json into node-red flows
     * ===========================================
     */
    function OppoInNode(config) {
        let getNodeStateAsString = (currentState) => (
            queryCommand.getNodeState ?
                queryCommand.getNodeState(currentState) :
                JSON.stringify(currentState));


        RED.nodes.createNode(this, config);
        this.name = config.name;
        let node = this;
        let oppoplayer = RED.nodes.getNode(config.player);
        let itemName = config.itemname;

        if (itemName !== undefined) itemName = itemName.trim();
        let queryCommand = queryCommands[itemName];

        node.refreshNodeStatus = function () {
            let currentState = node.context().get("currentState") || null;
            let currentStatus = node.context().get("currentStatus");
            let color = null;
            let shape = null;
            switch (currentStatus) {
                case 'OFF':
                    color = 'green';
                    shape = 'ring';
                    break;
                case 'ON':
                    color = 'green';
                    shape = 'dot';
                    break;
                case 'DISCONNECTED':
                    color = 'red';
                    shape = 'dot';
                    break;
                case 'CONNECTED':
                case 'RECONNECTING':
                    color = 'yellow';
                    shape = 'ring';
                    break;
                default:
                    color = 'gray';
                    shape = 'ring';
            }
            
            if (currentState === '?' || currentState === null )
                node.status({fill: color, shape: shape, text: "state: unknown"});
            else
                node.status({
                    fill: color,
                    shape: shape,
                    text: "state: " + (typeof currentState === 'object' ? getNodeStateAsString(currentState) : currentState)
                });
        };

        node.processPlayerEvent = function (event) {
            "use strict";

            node.context().set("currentStatus", event);

            if (event === 'ON') { // successfully connected
                if (queryCommand) { // valid command
                    oppoplayer.queueCommand(itemName);
                } else {
                    node.log('invalid query commend ' + itemName);
                }
            } else {
                node.context().set("currentState", null);
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
                node.send({_msgid: msgid, payload: currentState, topic: itemName});
            }
        };

        node.context().set("currentState", null);
        node.context().set("currentStatus", null);
        oppoplayer.addListener(itemName, node.processStateEvent);
        oppoplayer.addListener("PlayerStatus", node.processPlayerEvent);
        node.refreshNodeStatus();

        /* ===== Node-Red events ===== */
        node.on("input", function (msg) {
            if (msg != null) {
                oppoplayer.queueCommand(itemName);
            }
        });
        node.on("close", function () {
            oppoplayer.removeListener(itemName, node.processStateEvent);
            oppoplayer.removeListener("PlayerStatus", node.processPlayerEvent);
        });
    }

    RED.nodes.registerType("OPPO UDP 20x-in", OppoInNode);

    function OppoOutNode(config) {
        RED.nodes.createNode(this, config);
        this.config = config;
        let node = this;
        let oppoplayer = RED.nodes.getNode(config.player);
        let command = config.command;

        if (command !== undefined) command = command.trim();

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
                node.send([{_msgid: msgid, payload: currentState, item: command, event: "StateEvent"}, null]);
            }
        };

        node.context().set("currentState", "?");
        oppoplayer.addListener(command, node.processStateEvent);
        //node.refreshNodeStatus();

        /* ===== Node-Red events ===== */
        this.on("input", function (msg) {
            if (command === 'PAYLOAD') {
                oppoplayer.queueCommand(msg.payload);
            } else {
                if (typeof setCommands[command] === 'object' && !!setCommands[command].hasParameter) {
                    oppoplayer.queueCommand(command + ' ' + msg.payload.toString());
                } else {
                    oppoplayer.queueCommand(command);//, msg.payload.toString());
                }

            }
            if (msg != null) {

            }
        });
        this.on("close", function () {
            RED.log.trace('close');
            oppoplayer.removeListener(command, node.processStateEvent);
        });

    }

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
