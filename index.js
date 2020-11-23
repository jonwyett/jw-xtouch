/* TODO
    -startup options (ports)    
*/

/*
    ver 1.0.0 20-11-19

*/

/* Information about the X-Touch keys:

key: [144, 0-101, 0/127]
faders: [224-232, ???, 0-127]
knobs (rotation): [176, 16-23, 1/65]
knobs (button): [144, 32-39, 0/127]
knobs (lights): [176, 48-55,0-127] 
jog/shuttle: [176,60, 1/65]
Display-lights: 176
    small lights:
        solo: 115
        beats: 114
        smpte: 113

    Assignment: 75, 74
	Hours/Bars: 73, 72, 71
	Minutes/Beats: 70, 69
	Seconds/Sub Division: 68, 67
	Frames/Ticks: 66, 65, 64
	
	Values:
		48=0
		49=1
		50=2
		51=3
		52=4
		53=5
		54=6
		55=7
		56=8
		57=9
        58=OFF
        
Level Lights: [208, 0-127?, ???]

*/

var midi = require('midi');

var midiIn = new midi.Input();
var midiOut = new midi.Output();

var ON = 127;
var OFF = 0;
var BLINK = 1;

var BUTTON = 144;
var KNOB = 176;
var JOG = 60;
var DISPLAY = 176;
var SIGNAL = 208;

var faderModes = {
    'CH1': { mode: 'decibel', resolution: 1 },
    'CH2': { mode: 'decibel', resolution: 1 },
    'CH3': { mode: 'decibel', resolution: 1 },
    'CH4': { mode: 'decibel', resolution: 1 },
    'CH5': { mode: 'decibel', resolution: 1 },
    'CH6': { mode: 'decibel', resolution: 1 },
    'CH7': { mode: 'decibel', resolution: 1 },
    'CH8': { mode: 'decibel', resolution: 1 },
    'MAIN': { mode: 'decibel', resolution: 1 },

};


//raw is the midi response
//percent is the location of the fader at max resolution
//value is the converted value for the user
var faders = {
    CH1: { raw: [0,0], position: null, value: null},
    CH2: { raw: [0,0], position: null, value: null},
    CH3: { raw: [0,0], position: null, value: null},
    CH4: { raw: [0,0], position: null, value: null},
    CH5: { raw: [0,0], position: null, value: null},
    CH6: { raw: [0,0], position: null, value: null},
    CH7: { raw: [0,0], position: null, value: null},
    CH8: { raw: [0,0], position: null, value: null},
    MAIN: { raw: [0,0], position: null, value: null},
};

var faderMap = {
    //as buttons
    104: 'CH1',
    105: 'CH2',
    106: 'CH3',
    107: 'CH4',
    108: 'CH5',
    109: 'CH6',
    110: 'CH7',
    111: 'CH8',
    112: 'MAIN',
    //as fader movement
    224: 'CH1',
    225: 'CH2',
    226: 'CH3',
    227: 'CH4',
    228: 'CH5',
    229: 'CH6',
    230: 'CH7',
    231: 'CH8',
    232: 'MAIN',
    //reverse lookup movement
    'CH1': 224,
    'CH2': 225,
    'CH3': 226,
    'CH4': 227,
    'CH5': 228,
    'CH6': 229,
    'CH7': 230,
    'CH8': 231,
    'MAIN': 232
};


function debug(msg) {
    emit('debug', msg);
}

function error(msg) {
    emit('error', msg);
}

/*******************   Custom Emitter Code  ************************************/
//this is for future browser compatibility
var _events = {};
function on(event, callback) {
    //attaches a callback function to an event
    _events[event] = callback;    
}
function emit(event, msg) {
    if (typeof _events[event] === 'function') { //the client has registered the event
        _events[event](msg); //run the event function provided            
    } 
    if (event === 'action') {
        runControlMap(msg);
    }  
}
/******************************************************************************/

/*****************************************************************************/
/***** sendMidi functions ****************************************************/

var commandStack = [];
var commandInterval = null;
var commandDelay = 10;

var keySequence = null;

function sendMidi(midiMsg) {
    function inRange(num) {
        if (num <0 || num>127) { return false; }
        else { return true; }
    }
    function fail() {
        emit('sendMidi: ' + JSON.stringify(midiMsg) + ' is not array, is not 3 elements or has invalid elements');
    }
    if (!Array.isArray(midiMsg)) {
        fail();
    } else if (midiMsg.length !== 3) {
        fail();
    } else if (!inRange(midiMsg[1])) {
        fail();
    }

    commandStack.push(midiMsg);
	//if the midi interval is not already running
	if (!commandInterval) { 
        //immediately send the fist midi msg
        debug('MIDI Out: ' + commandStack[0]);
        try {
            midiOut.sendMessage(commandStack[0]);
        } catch (e) {
            emit('error', 'MIDI: ' + e);
        }
		commandStack.shift();
		//start the interval
		startMidiInterval(); 
	}
}

function startMidiInterval() {	
	commandInterval = setInterval(function() {
		if (commandStack.length > 0) {
            try {
                midiOut.sendMessage(commandStack[0]);
            } catch (e) {
                emit('error', 'MIDI: ' + e);
            }
            debug('MIDI Out: ' + commandStack[0]);
			commandStack.shift();
		} else {
			stopMidiInterval();
		}
	}, commandDelay);
}

function stopMidiInterval() {
	clearInterval(commandInterval);
	commandInterval = null;
	
	if (keySequence) { 
		sendKeys(keySequence); 
		keySequence = null;
	}
}

/*****************************************************************************/
/*****************************************************************************/

var mode = '';
var modeMap = {};
var controlMap = { foo: 'bar'};

function setMode(newMode) {
    if (typeof newMode !== 'undefined') { mode = newMode; }
    return mode;
}

function updateControlMap(map) {
    controlMap = map;
    return controlMap;
}

function updateModeMap(map) {
    modeMap = map;
    return modeMap;
}

function runControlMap(action) {
    var control = action.control;
    var name = action.name;
    var state = action.state;

    //First the specialized mode configurations
    try {
        if(typeof modeMap[mode][control] === 'function') {
            modeMap[mode][control](name, state);
            return true;
        }
    } catch (e) { }

    try {
        if (typeof modeMap[mode][control][name] === 'function') {
            modeMap[mode][control][name](state);
            return true;
        }
    } catch(e) { }

    try {
        if (typeof modeMap[mode][control][state][name] === 'function') {
            modeMap[mode][control][state][name]();
            return true;
        }
    } catch (e) { }
    
    try {
        if (typeof modeMap[mode][control][name][state] === 'function') {
            modeMap[mode][control][name][state]();    
            return true;
        } 
    } catch(e) { }
    

    //now the standard mappings

    //this checks for a mapping just based on the type
    //useful if you want to handle the entire type in your own function
    try {
        if (typeof controlMap[control] === 'function') {
            controlMap[control](name, state);
        }
    } catch (e) { }

    //this checks for a mapping based on the type, then the name and passes the state
    //this is most useful for faders, knobs or groups which have a variety of states
    try {
        if (typeof controlMap[control][name] === 'function') {
             controlMap[control][name](state);
             return true;
        }
    } catch(e) { }

    //this checks for a mapping based on type/state/name
    //so for example all the button presses that should fire on the 'up' state
    try {
        if (typeof controlMap[control][state][name] === 'function') {
            controlMap[control][state][name]();    
            return true;
        } 
    } catch(e) { }

    //this checks for a mapping based on type/name/state
    //this is better for when a different event happens on each state
    //best for the jog-shuttle wheel or when the knobs are in default mode
    try {    
        if (typeof controlMap[control][name][state] === 'function') {
            controlMap[control][name][state]();
            return true;
        }
    } catch(e) { }    
}


function callbackSafe(callback, option) {
    if (typeof callback === 'function') { callback(option); }
}


/**
 * Starts the midi device
 * 
 * @param {function} callback 
 * @param {object} options 
 */
function start(callback, options) {

    var midiDeviceIndex = -1;

    debug('MIDI Devices:');
    for (var i=0; i<midiOut.getPortCount(); i++) {
        var name = midiOut.getPortName(i);
        debug(i + ': ' + name);	
        if (name.toLowerCase().indexOf('x-touch') > -1 && midiDeviceIndex === -1) { 
            midiDeviceIndex = i; 
        }
    }

    if (midiDeviceIndex) { 
        debug('Found probable X-Touch on device ' + midiDeviceIndex);
    } else {
        debug("Didn't find expected midi device, using port " + midiDeviceIndex);
        midiDeviceIndex = 1;
    }


    if (options) {
        if (options.port) {
            if (!isNaN(options.port)) {
                midiDeviceIndex = options.port;
                debug('Using options.port = ' + options.port);
            }
        }
    }
    midiIn.openPort(0);
    try {
        midiOut.openPort(midiDeviceIndex);
        callbackSafe(callback, 'Midi open on port ' + midiDeviceIndex);
    } catch(e) {
        emit('error', e);
        callbackSafe(callback, 'Midi init failed on port ' + midiDeviceIndex);
    }
    
    
}


/**
 * Stops the midi device listener
 */
function stop() {
    midiIn.closePort();
    midiOut.closePort();
}

/**
 * Returns a listing of available midi ports
 */
function getPorts() {
    var ports = [];

    for (var i=0; i<midiOut.getPortCount(); i++) {
        ports.push(midiOut.getPortName(i));
    }

    return ports;

}
/*****************************************************************************/
/*****************************************************************************/

var buttons = {
    0:'CH1.REC', 1:'CH2.REC',2:'CH3.REC',3:'CH4.REC',4:'CH5.REC',5:'CH6.REC',6:'CH7.REC',7:'CH8.REC',
    8:'CH1.SOLO', 9:'CH2.SOLO', 10:'CH3.SOLO', 11:'CH4.SOLO', 12:'CH5.SOLO', 13:'CH6.SOLO',14:'CH7.SOLO',15:'CH8.SOLO',
    16:'CH1.MUTE', 17:'CH2.MUTE', 18:'CH3.MUTE', 19:'CH4.MUTE', 20:'CH5.MUTE', 21:'CH6.MUTE', 22:'CH7.MUTE', 23:'CH8.MUTE',
    24:'CH1.SELECT', 25:'CH2.SELECT', 26:'CH3.SELECT', 27:'CH4.SELECT', 28:'CH5.SELECT', 29:'CH6.SELECT', 30:'CH7.SELECT', 31:'CH8.SELECT',
    40:'TRACK', 41:'SEND', 42:'PAN/SURROUND', 43:'PLUG-IN', 44:'EQ', 45:'INST',
    46:'FADER BANK LEFT', 47:'FADER BANK RIGHT', 48:'CHANNEL LEFT', 49:'CHANNEL RIGHT', 
    50:'FLIP',
    51:'GLOBAL VIEW',
    52:'NAME/VALUE',
    53:'BEATS',
    54:'F1', 55:'F2', 56:'F3', 57:'F4', 58:'F5', 59:'F6', 60:'F7', 61:'F8',
    62:'MIDI TRACKS', 63:'INPUTS', 64:'AUDIO TRACKS', 65:'AUDIO INST', 66:'AUX', 67:'BUSES', 68:'OUTPUTS', 69:'USER',
    70:'SHIFT', 71:'OPTION', 72:'CONTROL', 73:'ALT',
    74:'READ/OFF', 75:'WRITE', 76:'TRIM', 77:'TOUCH', 78:'LATCH', 79:'GROUP',
    80:'SAVE', 81:'UNDO', 82:'CANCEL', 83:'ENTER',
    84:'MARKER', 85:'NUDGE', 86:'CYCLE', 87:'DROP', 88:'REPLACE', 89:'CLICK', 90:'SOLO',
    91:'REW', 92:'FWD', 93:'STOP', 94:'PLAY', 95:'REC', 
    96:'UP', 97:'DOWN', 98:'LEFT', 99:'RIGHT', 100:'ENTER',

    101:'SCRUB',
};

var  knobs = {
    16:'CH1', 17:'CH2', 18:'CH3', 19:'CH4', 20:'CH5', 21:'CH6', 22:'CH7', 23:'CH8',
};

var knobButtons = {
    32:'CH1', 33:'CH2', 34:'CH3', 35:'CH4', 36:'CH5', 37:'CH6', 38:'CH7', 39:'CH8'
};

knobLights = {
    'CH1':48, 'CH2':49,'CH3':50,'CH4':51,'CH5':52,'CH6':53,'CH7':54,'CH8':55
};

//codes for all the light patterns the knobs can display
var knobLightMap = {
    OFF: 0,
    noSideLights: {
        OFF:0,
        sequence: {
            0:0, OFF:0,
            1:1, 2:2, 3:3, 4:4, 5:5, 6:6,
            7:7, 8:8, 9:9, 10:10, 11:11 
        },
        pan: {
            OFF: 0,
            '-5':17, '-4':18, '-3':19, '-2':20, '-1':21,
            '0':22, 
            '1':23,  '2':24, '3':25, '4':26, '5':27 
        },
        level: {
            0:32, 1:33, 2:34, 3:35, 4:36, 5:37, 6: 38,
            7:39, 8:40, 9:41, 10:42, 11:43, //12:107
            //12 kinda works as it adds one light to the end, 
            //but it also adds an extra one to the beginning, so for now, no.
        }, 
        fill: {
            0:0, OFF:0,
            1:49, 2:50, 3:51, 4:52, 5:53, 6:54, 7:118
            //fill does get an extra value when not using side lights
        },
        normal: {
            0:0
        },
        //simple way to turn all lights on or off
        all: { 
            on: 118,
            off: 0
        }
    },
    sideLights: {
        OFF: 0,
        sequence: {
            0:64, 
            1:65, 2:66, 3:67, 4:68, 5:69, 6:70,
            7:71, 8:72, 9:73, 10:74, 11:75 
        },
        pan: {
            OFF: 80,
            '-5':81, '-4':82, '-3':83, '-2':84, '-1':85,
            '0':86, 
            '1':87,  '2':88, '3':89, '4':90, '5':91 
        },
        level: {
            0:96, 1:97, 2:98, 3:99, 4:100, 5:101, 6: 102,
            7:103, 8:104, 9:105, 10:106, 11:107
        }, 
        fill: {
            0:112, OFF:112,
            1:113, 2:114, 3:115, 4:116, 5:117, 6:118
        },
        normal: {
            0:0
        }
    }
};

//codes for lighting up the signal level meters
var signalMap = {
    'CH1' : {
        1:1, 2:3, 3:5, 4:7, 5:9, 6:11, 7:13, 8:14 ,'CLEAR':15
    },
    'CH2': {
        1:17, 2:19, 3:21, 4:23, 5:25, 6:27, 7:29, 8:30 ,'CLEAR':31
    },
    'CH3': {
        1:33, 2:35, 3:37, 4:39, 5:41, 6:43, 7:45, 8:46, 'CLEAR':47
    },
    'CH4': {
        1:49, 2:51, 3:53, 4:55, 5:57, 6:59, 7:61, 8:62, 'CLEAR':63
    },
    'CH5': {
        1:65, 2:67, 3:69, 4:71, 5:73, 6:75, 7:77, 8:78, 'CLEAR':79
    },
    'CH6': {
        1:81, 2:83, 3:85, 4:87, 5:89, 6:91, 7:93, 8:94, 'CLEAR':95
    },
    'CH7': {
        1:97, 2:99, 3:101, 4:103, 5:105, 6:107, 7:109, 8:110, 'CLEAR':111
    },
    'CH8': {
        1:113, 2:115, 3:117, 4:119, 5:121, 6:123, 7:125, 8:126, 'CLEAR':127
    },
};

//this are intervals for holding signal levels
var signalTimers = {
    'CH1': null, 'CH2': null, 'CH3': null, 'CH4': null, 
    'CH5': null, 'CH6': null, 'CH7': null, 'CH8': null
};

var displayElements = {
    'ASSIGNMENT': [75,74],
    'HOURS': [73,72,71],
    'BARS': [73,72,71],
    'MINUTES': [70,69],    
    'BEATS': [70,69],
    'SECONDS': [68,67],
    'SUB DIVISION': [68,67],
    'FRAMES': [66,65,64],
    'TICKS': [66,65,64]
};

//this tracks what's currently on the display so we don't need to waste time updating
//elements with the value they already have.
var displayElementValues= {
    75:null, 74:null, //assignment
    73:null, 72:null,71:null, //hours
    70:null, 69:null, //minutes
    68:null, 67:null, //seconds
    66:null, 65:null,64:null //frames
};

//TODO: remove
//declared outside scope for showTempMessage
//var oldDisplayMsg = {};

var displayMap = {
    'OFF':0, ' ':0,
    'A':1,'B':2,'C':3,'D':4,'E':5,'F':6,'G':7,'H':8,'I':9,'J':10,'K':11,'L':12,'M':13,
    'N':14,'O':15,'P':16,'Q':17,'R':18,'S':19,'T':20,'U':21,'V':22,'W':23,'X':24,'Y':25,'Z':26,
    '_':31, '"':34, '°':35, "'":39,
    '[':40,']':41, '|':44,
    '=':61,
    '.':64, '-':45, //65-90 letters with .
    '0':48,'1':49,'2':50,'3':51,'4':52,'5':53,'6':54,'7':55,'8':56,'9':57,
    '0.':112,'1.':113,'2.':114,'3.':115,'4.':116,'5.':117,'6.':118,'7.':119,'8.':120,'9.':121
};

var displayLights = {
    SOLO: 115, BEATS: 114, SMPTE: 113
};

//converts db into the closest point on the gross 127 point fader scale
var dbMap = {
    '-100':0, '-93':2, '-87':3, '-80':4, '-73':5, '-67':6, '-60':7, '-59':8,
    '-58':9, '-56':10, '-55':11, '-54':12, '-53':13, '-51':14, '-50':15,
    '-49':16, '-48':17, '-46':18, '-45':19, '-44':20, '-43':21, '-41':22,
    '-40':23, '-39':24, '-38':25, '-36':26, '-35':27, '-34':28, '-33':29,
    '-31':30, '-30':31, '-29':32, '-28':35, '-27':36, '-26':38, '-25':39,
    '-24':41, '-23':42, '-22':44, '-21':45, '-20':47, '-19':49, '-18':50,
    '-17':52, '-16':53, '-15':55, '-14':56, '-13':58, '-12':60, '-11':62,
     '-10':63, '-9':66, '-8':70, '-7':73, '-6':76, '-5':79, '-4':82, '-3':85,
      '-2':89, '-1':92, '0':95, '1':98, '2':101, '3':105, '4':108, '5':111,
       '6':114, '7':117, '8':120, '9':124, '10':127, 
};


/*****************************************************************************/
/*****************************************************************************/



var toggles = {};
var groups =  {};

//these lights should light when pressed
var autoButtonLights = [];


//object to store automatic light/value modes for knobs
var knobModes = {
    CH1: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH2: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH3: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH4: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH5: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH6: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH7: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
    CH8: { mode:'normal', value:0, sideLights: false, min:0, max:0 }    
};

/**
 * Set the mode for a knob to automate lights and values 
 * @param {string} knob - the knob to set
 * @param {string} mode - the mode
 * @param {boolean} sideLights - sidelights on
 * @param {number} value - a starting value
 */
function setKnobMode(name, mode, sideLights, value) {
    if (typeof name === 'undefined') {
        emit('error', 'setKnobMode: No knob specified');
        return false;
    }
    if (typeof mode === 'undefined') { mode = 'normal'; }
    if (typeof sideLights === 'undefined') { sideLights = false; }
    if (typeof value === 'undefined') { value = 0; }

    name = name.toUpperCase();
    mode = mode.toLowerCase();
    
    try {
        var knob = knobModes[name];
        knob.mode = mode;
        knob.sideLights = sideLights;
        knob.value = value;
        
        

        //set the min-max values
        switch(mode) {
            case 'sequence':
                knob.min = 1;
                knob.max = 11;
                knob.value = clamp(knob.value, knob.min, knob.max);
                setKnobLight(name, knob.mode, knob.value, knob.sideLights);
                break;
            case 'level':
                knob.min = 0;
                knob.max = 11;
                knob.value = clamp(knob.value, knob.min, knob.max);
                setKnobLight(name, knob.mode, knob.value, knob.sideLights);
                break;
            case 'pan':
                knob.min = -5;
                knob.max = 5;
                knob.value = clamp(knob.value, knob.min, knob.max);
                setKnobLight(name, knob.mode, knob.value, knob.sideLights);
                break;
            case 'fill':
                knob.min = 1;
                knob.max = sideLights? 6: 7; //bonus value if not using sidelights
                knob.value = clamp(knob.value, knob.min, knob.max);
                setKnobLight(name, knob.mode, knob.value, knob.sideLights);
                break;
            case 'normal':
                knob.min = 0;
                knob.max = 0;
                knob.value = 0;
                knob.sideLights = false;
                setKnobLight(name, knob.mode, knob.value, knob.sideLightMode);
                break;
            default:
                emit('error', 'setKnobMode: Invalid mode: ' + mode);
        }
        

    } catch (e) {
        emit('error', 'setKnobMode: ' + e);
    }
}

function processKnobModes(action) {
    try {
        var name = action.name;
        var change = action.state ==='right' ? 1 : -1;
        var knob = knobModes[name];
        var oldValue  = knob.value;
        
        if (knob.mode !== 'normal') {
            //set the new value
            knob.value += change;
            knob.value = clamp(knob.value, knob.min, knob.max);
            
            //set the lights
            setKnobLight(name, knob.mode, knob.value, knob.sideLights);   

            //emit the action only if the value has changed.
            if (oldValue !== knob.value) {
                emit('action', {
                    control: 'knob',
                    name: name,
                    state: knob.value    
                });
            }
        }


    } catch (e) {
        emit('error', 'Problem processing automatic knob mode: ' + e);
    }

}

/**
 * Adds a toggle group
 * @param {string} buttonName 
 * @param {object} toggle 
 */
function addToggle(buttonName, toggle) {
    toggles[buttonName] = toggle;
    //console.log('Toggles: ' + JSON.stringify(toggles));
    setButtonLight(buttonName, toggle.state);
}


function removeToggle(buttonName) {
    setButtonLight(buttonName, 'off');
    delete toggles[buttonName];
}

function setToggle(name, state, noCallback) {
    if (toggles[name]) {
        var toggle = toggles[name];
        if (toggle.state !== state) {
            setButtonLight(name, state);   
            if (!noCallback) { 
                if (state === 'on' || state === 'blink') {
                    emit('toggle', name, 'activate');
                } else {
                    emit('toggle', name, 'deactivate');
                }
            } 
        }
        if (state === 'blink') { 
            toggle.blink = true;
        }
        toggle.state = state;
    }    
}



function processToggles(name) {
    if (toggles[name]) {
        var toggle = toggles[name]; //simplify code
        if (toggle.state === 'on' || toggle.state === 'blink') {
            toggle.state = 'off';
            setButtonLight(name, toggle.state);
            emit('action', {
                control: 'toggle',
                name: name,
                state: 'deactivate'
            });
            return true;
            
        } else {
            if (toggle.blink) { toggle.state = 'blink'; }
            else { toggle.state = 'on'; }
            setButtonLight(name, toggle.state);
            emit('action', {
                control: 'toggle',
                name: name,
                state: 'activate'
            });
            return true;
        }            
    }
    return false;
}

/**
 * Adds a button group
 * @param {string} name
 * @param {object} group 
 */
function addGroup(name, group) {
    if (typeof groups[name] === 'object') {
        emit('error', 'addGroup: group "' + name + '" already exists');
        return false;
    }

    //add the group
    groups[name] = group;

    //make sure all the lights are off
    group.members.forEach(function(member) {
        setButtonLight(member, 'off');
    });

    //light the light if specified
    if (group.activeButton) {
        setButtonLight(group.activeButton, 'on');
    }
}

function removeGroup(name) {
    if (typeof groups[name] === 'object') {
        //first disable any lit lights
        setButtonLight(groups[name].activeButton, 'off');
              
        delete groups[name];
    }
}

function setGroup(name, button, noCallback) {
    if (typeof groups[name] === 'object') {
        button = button.toUpperCase();
        var group = groups[name];
        if (group.activeButton !== button) {
            setButtonLight(group.activeButton, 'off'); //the old button
            group.activeButton = button;
            setButtonLight(group.activeButton, 'on'); //the new button
            if (!noCallback) { 
                emit('action', {
                    control: 'group',
                    name: name,
                    state: group.activeButton
                });
            }
        }
    }
}

function isInGroup(name) {
    var keys = Object.keys(groups);
    for (var i=0; i<keys.length; i++) {
        if (groups[keys[i]].members.includes(name)) { return true ;}
    }
    
    return false;
}

function isInToggle(name) {
    var keys = Object.keys(toggles);
    for (var i=0; i<keys.length; i++) {
        if (keys[i] == name) { return true ;}
    }
    
    return false;    
}

function processGroups(btnName) {
    var oldBtn = '';
    var group = {};
    //check each group
    var keys = Object.keys(groups);
    var name = '';
    for (var i=0; i<keys.length; i++) {
        name = keys[i];
        if (typeof groups[name] === 'object') {
            group = groups[name];
            var member = '';
            for (var m=0; m<group.members.length; m++) {
                member = group.members[m];
                if (member == btnName) { //soft check
                    //if an active button was set, turn it off
                    if (group.activeButton) {
                        setButtonLight(group.activeButton, 'off');
                        oldBtn = group.activeButton;
                    }
                    //set the active button to the one pressed
                    group.activeButton = btnName;
                    //turn it on
                    setButtonLight(group.activeButton, 'on');
                    //only run the callback if there's a change
                    if (oldBtn !== group.activeButton) {
                        emit('action', {
                            control: 'group',
                            name: name,
                            state: group.activeButton
                        });
                        return true;
                    } else {
                        emit('action', {
                            control: 'group',
                            name: name,
                            state: 'touch'
                        });
                        return true;
                    } 
                }
            }
        }
    }
    return false;
}

function processFaderRelease(value) {
    var response = {
        control: 'fader',
        name: faderMap[value],
        state: 'release'
    };
    emit('action', response);
    
    var fader = faderMap[value];
    //console.log('fader: ' + value + '=' + fader);
    //console.log('raw: ' + faders[fader].raw);
    sendMidi([faderMap[fader], faders[fader].raw[0], faders[fader].raw[1]]);
}

function processFader(fader, value, state) {
    //convert fader number to name
    fader = faderMap[fader];
    //check to see if the new value is the same as value
    //this will be true when the fader is touched and before it moves
    //console.log('OLD: ' + faders[fader].raw + ' = ' + [value,state]);
    if (faders[fader].raw[0] === value && faders[fader].raw[1] === state) {
        var response = {
            control: 'fader',
            name: fader,
            state: 'touch'
        };
        emit('action', response);    
        faders[fader].raw = [value, state];
    } else {
        faders[fader].raw = [value, state];
        processFaderValue(fader);
    }

    
}


function processFaderValue(fader) {
    var val, iPart, fPart;
    
    iPart = faders[fader].raw[1]; //the integer part
    iPart /= 127; //convert to ratio

    fPart = faders[fader].raw[0]; //the fractional part
    fPart /= 127; //convert to ratio
    fPart /= 100; //convert to fraction

    val = iPart + fPart; //add them together
 
    faders[fader].position = val;

    var oldValue = faders[fader].value; //save the old value for later

    if (faderModes[fader].mode === 'position') {
        val = faders[fader].position; //just to be safe

        val *= faderModes[fader].resolution; //convert to provided resolution
        val = parseInt(val); //strip fractional part   
        faders[fader].value = val; // set the value

    } else if (faderModes[fader].mode === 'decibel') {
        var lastMajor = 'debug'; //this will hold the last major decibel marking we will count from
        var offset = null; //this is the range of the lastMajor decibel
        var range = faders[fader].raw[1]; //this is a 0-127 increment
        var D = 0; //the gross Distance between the major decibel markings
        var C = 0; // the Count between the decibels
        
        //we're using a 127-point scale for the range, so convert the position to that scale
        //we're not going to strip the decimal though.
        var position = faders[fader].position * 127;   

        //determine the D value
        
        if (range >=31) { 
            D = 16;
        } else if (range >=7 && range < 31) {
            D = 8;
        } else if (range < 7) {
            D = 8;
        }

        //determine the C value
        if (range >=7 && range <63) {
            C = 10; //10 decibels between each major
        } else if (range >= 63) {
            C = 5; //5 db btw each major
        } else if (range <7) {
            C = 40;
        }

        //determine the lastMajor decibel
        if (range >= 7 && range < 15) {
            lastMajor = -60;
            offset = 7;
        } else if (range >=15 && range < 23) {
            lastMajor = -50;
            offset = 15;
        } else if (range >=23 && range < 31) {
            lastMajor = -40;
            offset = 23;
        } else if (range >= 31 && range <47) {
            lastMajor = -30;
            offset = 31;
        } else if (range >=47 && range <63) {
            lastMajor = -20;
            offset = 47;
        } else if (range >=63 && range < 79) {
            lastMajor = -10;
            offset = 63;
        } else if (range >=79 && range <95) {
            lastMajor = -5;
            offset = 79;
        } else if (range >=95 && range <111) {
            lastMajor = 0;
            offset = 95;
        } else if (range >=111) {
            lastMajor = 5;
            offset = 111;
        } else if (range <7) {
            lastMajor = -100;
            offset = 1;
        }

        //compute the final decimal value
        if (D && C && lastMajor != 'debug') { //TODO: Remove this test after debugging
            var delta = position - offset; //how far we've moved from the gross range 
            
            //console.log('---D:' + D + '|C:' + C + '|LM:' + lastMajor + '|P:' + position + '|DLT:' + delta + '|R:' + range);
            
            
            val = delta / D; //percent we've moved based on distance between major decibels
            val *= C; //convert to the count

            var db = lastMajor + val; //the final decibel value

            //console.log('DB: ' + db);

            db = roundToFraction(db, faderModes[fader].resolution);

            faders[fader].value = db;
        }
    }

    
    if (faders[fader].value !== oldValue) {
        //console.log('FADER ' + fader + ': ' + faders[fader].position + '=' + faders[fader].value);
        var response = {
            control: 'fader',
            name: fader,
            state: faders[fader].value   
        };
        emit('action', response);
    }

    
}

/***************************************************************************************/
/***************************************************************************************/

function getRotation(state) {
    if (state>0 && state <6) {
        return 'right';
    } else if (state>60 & state<70) {
        return 'left';
    } else {
        return null;
    }
}

midiIn.on('message', function(d, message) {
	debug('Midi Received: ' + message);
	var type = message[0];
	var value = message[1];
    var state = message[2];

    var response = {};
    
    //this is set to true if a toggle or group takes precedence
    //end the normal button state action will not trigger
    var doNotEmitStandardActions = false;

    //find the name associated with the index
    //response.name = buttons[value];

    //will fail if the name isn't found
    var name = null;

    if (type === BUTTON ) { 
        //first check to see if it was a fader
        if (value >=104 && value <=112) {
            processFaderRelease(value);
        } else { //now process the button
            name = buttons[value];
            if (name) {
                response.control = 'button';
                response.name = name;
                if (state === ON) { 
                    response.state = 'down';
                    doNotEmitStandardActions = processToggles(response.name); 
                    //if a toggle is found doNotEmitStandardActions will be true and we wont check the groups
                    if (!doNotEmitStandardActions) {
                        doNotEmitStandardActions = processGroups(response.name);
                    }
                    if (autoButtonLights.includes(name) && !doNotEmitStandardActions) { 
                        setButtonLight(name, 'on');
                    }

                }
                else if (state === OFF) { 
                    response.state = 'up'; 
                    doNotEmitStandardActions = isInToggle(name);
                    //if the button is a toggle dont bother testing groups
                    if (!doNotEmitStandardActions) {
                        doNotEmitStandardActions = isInGroup(name);
                    }

                    if (autoButtonLights.includes(name) && !doNotEmitStandardActions) { 
                        setTimeout(function() {
                            setButtonLight(name, 'off');
                        }, 50);
                    }
                    
                }
            } else {
                name = knobButtons[value];
                if (name) {
                    response.control = 'knob';
                    response.name = name;
                    if (state === ON) { response.state = 'down'; }
                    else if (state === OFF) { response.state = 'up'; }
                }
            } 
        }
    } else if (type === KNOB) {
        name = knobs[value];
        if (name) {
            response.name = name;
            response.state = getRotation(state);
            //if the rotation isn't found then the control wont be set so it wont emit an action
            if(response.state) { response.control = 'knob'; }
        } else if (value === JOG) {
            response.name = 'JOG/SHUTTLE';
            response.state = getRotation(state);
            if(response.state) { response.control = 'jog/shuttle'; }

        }
    } else if (type >=224 && type <=232) {
        processFader(type, value, state);
        return null;
    }

    if (response.control && !doNotEmitStandardActions) {
        emit('action', response);
        //if a knob was found run the automatic knob mode
        //this will double-emit if found, which seems like the right call
        //the user can simply listen for the appropriate state and even act on both if wanted
        if (response.control === 'knob') {
            processKnobModes(response);
        }
    }

});

/**
 * Turns all the lights on/off/blink
 * @param {('on'|'off'|'blink')} state
 */
function setAllButtonLights(state) {
    if (state !== 'on' && state !== 'off' && state !== 'blink') {
        error('setAllButtonLights - invalid state "' + state + '", use on/off/blink');
        return null; 
    } else {
        if (state === 'on') { state = ON; }
        else if (state === 'off') { state = OFF; }
        else if (state === 'blink') { state = BLINK; }
    }


    Object.keys(buttons).forEach(function(key) {
        sendMidi([BUTTON, key, state]);
    });
}

/**
 * Changes the light for a button
 * @param {string} name - the name of the button
 * @param {('on'|'off'|'blink')} state 
 */
function setButtonLight(name, state) {
    
    if (state !== 'on' && state !== 'off' && state !== 'blink') {
        error('setLight - invalid state "' + state + '", use on/off/blink');
        return null; 
    } else {
        if (state === 'on') { state = ON; }
        else if (state === 'off') { state = OFF; }
        else if (state === 'blink') { state = BLINK; }
    }

    /**********************************************************************/

    var btnIndexes = Object.keys(buttons);
    for (var i=0; i<btnIndexes.length; i++) {
        if (buttons[btnIndexes[i]] == name) {
            sendMidi([BUTTON, btnIndexes[i], state]);    
            return true;
        } 
    }
    
    //this block will only be found if the name isn't found
    error('setLight - button name not found "' + name + '"');
    return false;
}

/**
 * Clears the display area
 * @param {boolean} force
 */
function clearDisplay(force) {
    Object.keys(displayElements).forEach(function(key) {
        displayElements[key].forEach(function(elem) {
            if (force) {
                sendMidi([DISPLAY, elem, displayMap.OFF]); 
            } else {
            if (displayElementValues[elem] != 'OFF') {
                sendMidi([DISPLAY, elem, displayMap.OFF]);        
                }
            }
        });
    });
    Object.keys(displayElementValues).forEach(function(key) {
        displayElementValues[key] = 'OFF';
    });
}

function addDecimal(value, isNeg) {
    var newValue = [];
    var start = 0;

    if (isNeg) {
        newValue[0] = value[0];
        start = 1;
    }

    for (var i=0; i<value.length; i++) {
        if (!isNaN(value[i])) {
            newValue.push(value[i]); //copy the element
            if (i+1<value.length && isNaN(value[i+1])) { //the next element is NaN = decimal point
                newValue[i] = value[i].toString() + '.';
            }    
        }
    }
    return newValue;
}

/**
 * Outputs a value to the display
 * @param {string} elementName 
 * @param {string|number} value 
 * @param {boolean} rightAlign 
 * @param {number} toFixedValue
 */
function setDisplay(elementName, value, rightAlign, toFixedValue) {
    //if no elementName provided, then use all available elements
    if (!elementName || elementName === 'all') { 
        elementArray = ['assignment','HOURS','beats','SECONDS','ticks'];
    } else if (elementName === 'full') { 
        //if you send 'full' then all elements after the dash will be used 
        elementName = ['HOURS','beats','SECONDS','ticks'];
    }

    if (toFixedValue) {
        value = parseFloat(value); //convert from string
        if (toFixedValue === 0) { 
            value = Math.round(value); //toFixed doesn't round integers for some reason
        } else {
            value = value.toFixed(toFixedValue); //now it's a string regardless
        }
        
    }

    var val = null;
    var i;

    var elementArray = [];
    if (typeof elementName === 'string' && isNaN(elementName)) {
        elementArray = displayElements[elementName.toUpperCase()];
    } else if (Array.isArray(elementName)) {
        elementName.forEach(function(element) {
            elementArray = elementArray.concat(displayElements[element.toUpperCase()]);
        });
    } else if (!isNaN(elementName)) { 
        //if the user give the actual display number code
        //this is meant for internal use for showTempMessage
        elementArray.push(elementName);
    }
    
    //console.log(elementArray);
    if (elementArray) {
        //clear the element and quit if the value is specifically false
        if (!value && value !== 0 && typeof value !== 'string') {
            for (i=0; i<elementArray.length; i++) {
                if (displayElementValues[elementArray[i]] != 'OFF') {
                    sendMidi([DISPLAY, elementArray[i], displayMap.OFF]);
                }
            }
            return true;
        }

        //this will convert a number into an array and add formatting
        if (!isNaN(value)) {
            var isNeg = false;
            if (value < 0) { isNeg = true; }

            value = Array.from(String(value), Number);
            if (isNeg) { value[0] = '-'; } //first element will be null for negative numbers, replace with -
            
            value = addDecimal(value, isNeg); //decimal will be null, replace with .
            
              
        } else if (typeof value === 'string') {
            value = value.toUpperCase().split('');
            //this makes sure spaces render properly
            for (var v=1; v<value.length; v++) {
                if (value[v] === ' ') { value[v] = 'OFF'; }
            }
        }

        //set the alignment
        var sizeDiff = elementArray.length-value.length; //compute the white-space
        if (value.length < elementArray.length) {
            if (rightAlign) { 
                for (i=0; i<sizeDiff; i++) {
                    value.unshift('OFF');
                }  
            }
            else {
                for (i=0; i<sizeDiff; i++) {
                    value.push('OFF');
                }
            }
        }

        
        for (i=0; i<elementArray.length; i++) {
            val = null;
            if (displayMap[value[i]] || displayMap[value[i]] === 0) {
                val = displayMap[value[i].toString().toUpperCase()];
                }
            if (val || val === 0) {
                
                //check to see if the element already has the value
                if (displayElementValues[elementArray[i]] != value[i]) { //soft check cause why not
                    //send the new value
                    sendMidi([DISPLAY, elementArray[i], val]);
                    //update the map
                    displayElementValues[elementArray[i]] = value[i]; 
                    //if (value[i] === 'OFF')  
                }                    
            } else {
                if (val !== null) { error('Invalid display value: ' + displayMap[value[i]]); }
            }
            
        }        
    } else {
        error('Invalid element name ' + elementName);
    }
}

/**
 * Shows a temporary message on the display
 * @param {string} message 
 * @param {number} delay
 */
function showTempMessage(message, delay) {
    if (typeof delay === 'undefined') { delay = 1000; }
    //make a copy not a reference
    var oldDisplayMsg = JSON.parse(JSON.stringify(displayElementValues));
    //console.log('old msg = ' + JSON.stringify(oldDisplayMsg));
    setDisplay('full', message);
    setTimeout(function() {
        //console.log('Setting display to: ' + JSON.stringify(oldDisplayMsg));
        Object.keys(oldDisplayMsg).forEach(function(elem) {
            if (oldDisplayMsg[elem] === 'OFF') {
                sendMidi([DISPLAY, elem, displayMap[' ']]);
            } else {
                sendMidi([DISPLAY, elem, displayMap[oldDisplayMsg[elem]]]);
            }
        });
        
    }, delay);
}

/**
 * Set the small indicators on the display panel
 * @param {string} name 
 * @param {string|boolean} state 
 */
function setDisplayLight(name, state) {
    try {
        if (state === 'on' || state === true) {
            sendMidi([BUTTON, displayLights[name], ON]);
        } else if (state === 'blink') {
            sendMidi([BUTTON, displayLights[name], BLINK]);
        } else {
            sendMidi([BUTTON, displayLights[name], OFF]);
        }
    } catch(e) {
        emit('error', 'setDisplayLights: Invalid params, ' + [name, state]);
    }
}

function setAllDisplayLights(state) {
    Object.keys(displayLights).forEach(function(name) {
        if (state === 'on' || state === true) {
            sendMidi([BUTTON, displayLights[name], ON]);
        } else if (state === 'blink') {
            sendMidi([BUTTON, displayLights[name], BLINK]);
        } else {
            sendMidi([BUTTON, displayLights[name], OFF]);
        }
    });   
}

/**
 * Sets the position of the fader
 * 
 * @param {string} fader 
 * @param {number} value 
 */
function setFader(fader, value) {
    if (typeof fader === 'string') { fader = fader.toUpperCase(); } 
    else { return null; }

    if (isNaN(value)) {
        emit('error', 'setFader: value is NaN (' + value + ')');
        return null;
    }
    var payload = [];
    var pos = 0;

    if (faderModes[fader].mode == 'position') {
        value = clamp(value, 0, faderModes[fader].resolution);
        pos = 0;
        var k = value / faderModes[fader].resolution; //the percentage
        pos = parseInt(k * 127);// k will be a fraction, there are 127 steps in the gross midi command        
    } else if (faderModes[fader].mode === 'decibel') {
        value = clamp(value, -100, 10);
        value = parseInt(value);
        pos = dbMap[value];
    }
    payload = [faderMap[fader], 0, pos];
    sendMidi(payload);
}

/**
 * Resets the faders to unity or -infinity
 * @param {boolean} unity 
 */
function resetFaders(unity) {
    var state = unity? 98: 0;
    for (var i=224; i<=232; i++) {
        sendMidi([i, 0, state]);
    }
}

/**
 * Turns off all the knob lights and resets the mode
 */
function clearKnobModes() {
    Object.keys(knobModes).forEach(function(knob) {
        setKnobLight(knob, 'sequence', 'OFF');
    });

    knobModes = {
        CH1: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH2: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH3: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH4: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH5: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH6: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH7: { mode:'normal', value:0, sideLights: false, min:0, max:0 },
        CH8: { mode:'normal', value:0, sideLights: false, min:0, max:0 }    
    };
}

/**
 * Sets the mode and resolution of 1 or all faders
 * @param {string} fader - the name of the fader or "all"
 * @param {string} mode - decibel/position
 * @param {number} resolution - a number or fraction setting the resolution
 */
function setFaderMode(fader, mode, resolution) {
    if (mode != 'decibel' && mode != 'position') {
        emit('error', 'setFaderMode: Invalid mode');
    }
    
    if (fader == 'all') {
        faderModes = {
            'CH1': { mode: mode, resolution: resolution },
            'CH2': { mode: mode, resolution: resolution },
            'CH3': { mode: mode, resolution: resolution },
            'CH4': { mode: mode, resolution: resolution },
            'CH5': { mode: mode, resolution: resolution },
            'CH6': { mode: mode, resolution: resolution },
            'CH7': { mode: mode, resolution: resolution },
            'CH8': { mode: mode, resolution: resolution },
            'MAIN': { mode: mode, resolution: resolution },
        
        };    
    }
    
    try {
        faderModes[fader].mode = mode;
        faderModes[fader].resolution = resolution;
    } catch (e) {
        emit('error', 'setFaderMode: ' + e);
    }
}

/**
 * 
 * @param {string} knob - the knob to light
 * @param {string} mode - light mode
 * @param {number/string} value - which lights to light
 * @param {boolean} showSideLights - show the lights on the side
 */
function setKnobLight(knob, mode, value, showSideLights) {
    var knobCode = knobLights[knob];

    var sideLightMode = 'noSideLights';
    if (showSideLights) { sideLightMode = 'sideLights'; }

    var lightCode = knobLightMap[sideLightMode][mode][value];
    if (lightCode || lightCode === 0) {
        sendMidi([KNOB, knobCode, lightCode]);
    } else {
        emit('error', 'setKnobLight: no light code associated with ' + mode + ':' + value);
    }
}

/**
 * sets the signal level bars
 * @param {string} channel 
 * @param {number|string} level 
 */
function setSignalLevel(channel, level) {
    if (typeof level === 'number') { level = clamp(level, 0, 8); }
    try {
        var code = signalMap[channel][level];
        //('sig code: ' + code);
        //console.log('Send: ' + [SIGNAL, code, 0]);
        sendMidi([SIGNAL, code, 0]);
    } catch (e) {
        emit('error', 'setSignalLevel: ' + e);
    }
   
}

/**
 * clears all the clip lights on the signal bars
 */
function clearSignalBars() {
    Object.keys(signalMap).forEach(function(channel) {
        sendMidi([SIGNAL, signalMap[channel].CLEAR, 0]);
    });
}

/**
 * Sends a raw midi msg to the controller
 * @param {array} triplet 
 */
function sendRAW(triplet) {
    sendMidi(triplet);
}

function holdSignalLevel(channel, level) {
    if (typeof level === 'number') { level = clamp(level, 1, 8); } //should this be 0-8?
    signalTimers[channel] = setInterval(function() {
        sendMidi([SIGNAL, signalMap[channel][level], 0]);
    }, 125);     
}

function clearSignalHold(channel) {
    clearInterval(signalTimers[channel]);
    sendMidi([SIGNAL, signalMap[channel].CLEAR, 0]);
}

function setAutoButtonLights(shouldAutoLight, ...buttonNames) {
    if (buttonNames[0] === 'all') { 
        buttonNames = [];
        Object.keys(buttons).forEach(function(key) {
            buttonNames.push(buttons[key]);
        });
    }

    buttonNames.forEach(function(button) {
        if (shouldAutoLight) {
            if (!autoButtonLights.includes(button)) {
                autoButtonLights.push(button);
            }
        } else {
            if (autoButtonLights.includes(button)) {
                autoButtonLights.splice(autoButtonLights.indexOf(button), 1);
            }
        }  
    });
}

/***************************************************************************************/
/***************************************************************************************/

exports.start = start;
exports.stop = stop;
exports.getPorts = getPorts;
exports.on = on;
exports.setButtonLight = setButtonLight;
exports.setAllButtonLights = setAllButtonLights;
exports.setDisplay = setDisplay;
exports.clearDisplay = clearDisplay;

exports.sendRAW = sendRAW;

exports.addToggle = addToggle;
exports.removeToggle = removeToggle;
exports.setToggle = setToggle;
exports.addGroup = addGroup;
exports.setGroup = setGroup;
exports.removeGroup = removeGroup;
exports.setFader = setFader;
exports.setKnobLight = setKnobLight;
exports.setKnobMode = setKnobMode;
exports.clearKnobModes = clearKnobModes;
exports.setDisplayLight = setDisplayLight;
exports.setAllDisplayLights = setAllDisplayLights;
exports.resetFaders = resetFaders;
exports.setFaderMode = setFaderMode;

exports.setSignalLevel = setSignalLevel;
exports.clearSignalBars = clearSignalBars;
exports.holdSignalLevel = holdSignalLevel;
exports.clearSignalHold = clearSignalHold;
exports.setAutoButtonLights = setAutoButtonLights;
exports.showTempMessage = showTempMessage;

exports.controlMap = updateControlMap;
exports.modeMap = updateModeMap;
exports.mode = setMode;


/*****************************************************************************/

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function roundToFraction(num, fraction) {
    //rounds a float number to a fractional part as a decimal
    //will also round to an integer value
    /* Accepted fractions:
        1/10: '0.1'
        1/8: '0.125'
        1/4: '0.25'
        1/2: '0.5'
        1: '1'
        5: '5'
        10: '10'
    */
    var dec;
    var scale = 1;
    switch (fraction) {
        case 0.1:
            num *= 10;
            num = Math.round(num);
            num = num / 10;
            num = parseFloat(num.toFixed(2));
            break;
        case 0.125:
            if (num < 1) {
                scale = -1;
                num *= scale;
            }
            dec = num % 1;
            num = num - dec;
            if (dec < 0.0625) {dec = 0;}
            else if(dec >= 0.0625 && dec < 0.1875) {dec = 0.125;}
            else if(dec >= 0.1875 && dec < 0.3125) {dec = 0.25;}
            else if(dec >= 0.3125 && dec < 0.4375) {dec = 0.375;}
            else if(dec >= 0.4375 && dec < 0.5625) {dec = 0.5;}
            else if(dec >= 0.5625 && dec < 0.6875) {dec = 0.625;}
            else if(dec >= 0.6875 && dec < 0.8125) {dec = 0.75;}
            else if(dec >= 0.8125 && dec < 0.9375) {dec = 0.875;}
            else dec = 1.0;
            num = (num + dec) * scale;
            num = parseFloat(num.toFixed(3));
            break;
        case 0.25:
            if (num < 1) {
                scale = -1;
                num *= scale;
            }    
            dec = num % 1;
            dec = Math.round(dec * 100)/100;
            num = num - dec;
            if (dec < 0.125) {dec = 0;}
            else if(dec > 0.125 && dec <= 0.25) {dec = 0.25;}
            else if(dec >= 0.365 && dec < 0.625) {dec = 0.5;}
            else if(dec >= 0.625 && dec < 0.875) {dec = 0.75;}
            else dec = 1.0;
            if (num < 0) {dec *= -1;}
            num = (num + dec) * scale;
            num = parseFloat(num.toFixed(2));
            break;
        case 0.5:
            if (num < 1) {
                scale = -1;
                num *= scale;
            } 
            dec = num % 1;
            dec = Math.round(dec * 100)/100;
            num = num - dec;
            if (dec < 0.25) {dec = 0;}
            else if (dec >= 0.25 && dec < 0.75) {dec = 0.5;}
            else {dec = 1;}
            if (num < 0) {dec *= -1;}
            num = (num + dec) * scale;
            num = parseFloat(num.toFixed(1));
            break;
        case 1:
            num = Math.round(num);
            break;
        case 5:
            if (num < 1) {
                scale = -1;
                num *= scale;
            } 
            num /= 10;
            dec = num % 1;
            num -= dec;
            if (dec < 0.3) {dec = 0;}
            else if (dec >= 0.3 && dec <0.7) {dec = 0.5;}
            else {dec = 1;}
            if (num < 0) {dec *= -1;}
            num = ((num + dec) * 10) * scale;
            num = Math.round(num);
            break;
        case 10:
            if (num < 1) {
                scale = -1;
                num *= scale;
            } 
            num /= 10;
            dec = num % 1;
            num -= dec;
            if (dec < 0.5) {dec = 0;}
            else {dec = 10;}
            if (num < 0) {dec *= -1;}
            num = ((num * 10) + dec) * scale;
            num = Math.round(num);
            break;
    }
    return num;
}