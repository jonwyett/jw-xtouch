var XT = require('./index');


XT.on('debug', function(msg) {
    //console.log(':> ' + msg);
});

XT.on('error', function(msg) {
    console.log('ERROR: ' + msg);
});

XT.on('action', function(action) {
    console.log('X-Touch: ' + JSON.stringify(action));
    processAction(action);
});

XT.start(function(msg) {
    console.log('Midi Init: ' + msg);  
    startUp();
});


function startUp() {
    XT.resetFaders();
    XT.clearKnobModes();
    XT.clearDisplay();
    XT.setDisplay('full', 'hello', true);
    XT.clearSignalBars();


    XT.setAutoButtonLights(true,
         'TRACK', 'PAN/SURROUND', 'EQ',
         'SEND', 'PLUG-IN', 'INST'
    );
    
    XT.addGroup('mode', {
        members: ['F1','F2','F3','F4','F5','F6','F7','F8'],
    });
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**********************************************************************/
/**********************************************************************/
/**********************************************************************/

var key = 0;

var control = 0;
var state = 0;
var value = 0;
var autoMidi = false;
//var mode = '';

function setupMode(mode) {
    XT.setDisplay('ASSIGNMENT', mode);
    //mode = newMode;
    //XT.removeGroup('clipDemo');
    XT.removeToggle('FLIP');
    XT.clearKnobModes();

    XT.setButtonLight('CH7.SELECT', 'off');
    XT.setButtonLight('CH7.MUTE', 'off');
    XT.setButtonLight('CH7.SOLO', 'off');
    XT.setButtonLight('CH7.REC', 'off');

    XT.setButtonLight('CH8.SELECT', 'off');
    XT.setButtonLight('CH8.MUTE', 'off');
    XT.setButtonLight('CH8.SOLO', 'off');
    XT.setButtonLight('CH8.REC', 'off');

    XT.setAutoButtonLights(false, 
        'CH7.SELECT','CH7.SOLO','CH7.MUTE','CH7.REC',
        'CH8.SELECT','CH8.SOLO','CH8.MUTE','CH8.REC'
    );

    if (mode === 'F1') {
        key = 0;
        XT.setDisplay('full', 'keymap');
        XT.setKnobLight('CH8', 'all', 'on');
        XT.removeToggle('FLIP');
        setTimeout(function() {
            XT.setDisplay('full', false);  
            XT.setDisplay('BARS', key, true); 
            setKeyTest();
        }, 1500);
    } else if (mode === 'F2') {
        XT.addToggle('FLIP', {
            state: 'off',
            blink: true
        });

        control = 176;
        state =75;
        value = 0;
        XT.setDisplay('full', 'midi test');
        XT.setKnobLight('CH6', 'all', 'on');
        XT.setKnobLight('CH7', 'all', 'on');
        XT.setKnobLight('CH8', 'all', 'on');
        setTimeout(function() {
            XT.setDisplay('full', false);  
            updateMidiDisplay(0,0,0);
        }, 2500);
    } else if (mode ==='F3') {
        XT.setDisplay('full', 'clip demo');
        XT.setButtonLight('CH7.SELECT', 'blink');
        XT.setButtonLight('CH7.MUTE', 'blink');
        XT.setButtonLight('CH7.SOLO', 'blink');
        XT.setButtonLight('CH7.REC', 'blink');
        XT.setButtonLight('CH8.SELECT', 'blink');
        XT.setButtonLight('CH8.MUTE', 'blink');
        XT.setButtonLight('CH8.SOLO', 'blink');
        XT.setButtonLight('CH8.REC', 'blink');
        XT.setAutoButtonLights(true, 
            'CH7.SELECT','CH7.SOLO','CH7.MUTE','CH7.REC',
            'CH8.SELECT','CH8.SOLO','CH8.MUTE','CH8.REC'
        );
        setTimeout(function() {
            XT.setDisplay('full', 'use ch btn');
        }, 1500);
        /*
        XT.addGroup('clipDemo' ,{
            members: ['CH8.REC','CH8.SOLO', 'CH8.MUTE', 'CH8.SELECT'],
        });
        */
    } else if (mode === 'F4') {
        XT.resetFaders(true);
        XT.setDisplay('full', 'FADER DEMO');
        XT.setFaderMode('CH1', 'position', 127);
        XT.setFaderMode('CH2', 'position', 512);
        XT.setFaderMode('CH3', 'position', 100);
        XT.setFaderMode('CH4', 'decibel', 0.5);
    } else if (mode === 'F5') {
        XT.setDisplay('full', 'knob demo');
        XT.setKnobMode('CH1', 'level');
        XT.setKnobMode('CH2', 'sequence');
        XT.setKnobMode('CH3', 'pan');
        XT.setKnobMode('CH4', 'fill');
    }
}



function updateKeyDisplay(val) {
    //console.log('updated key disp');
    key = clamp(key += val, 0, 127);
    XT.setDisplay('BARS', key, true);
    setKeyTest();
}

function setKeyTest() {
    XT.sendRAW([176, 64, key]);
}

function updateMidiDisplay(c, s, v) {
    control = clamp(control += c, 0, 255);
    state = clamp(state += s, 0, 127);
    value = clamp(value += v, 0, 255);

    XT.setDisplay('BARS', control, true);
    XT.setDisplay(['BEATS','SECONDS'], state, true);
    XT.setDisplay('TICKS', value, true);

    setMidiTest(autoMidi);
}

function setMidiTest(force) {
    if (force) {
        console.log('TEST MIDI: ' + JSON.stringify([control, state, value]));
        XT.sendRAW([control, state, value]);    
    }
}

function showFaderVal(name, val) {
    if (!isNaN(val)) {
        XT.setDisplay(['BARS','BEATS'], name);
        if (val === 0) {
            XT.setDisplay(['SECONDS','FRAMES'], 'unity', true);    
        } else if (val <= -100) {
            XT.setDisplay(['SECONDS','FRAMES'], '-inf', true);
        } else {
            XT.setDisplay(['SECONDS','FRAMES'], val, true, 1);
        }
    }
}

function showKnobValue(name, val) {
    if (!isNaN(val)) {
        XT.setDisplay(['BARS','BEATS'], name);
        XT.setDisplay(['SECONDS','FRAMES'], val, true);    
    }
}

//this holds all the custom actions based on the function mode selected
XT.modeMap({
    'F1': {
        button: {
            up: {
                'NAME/VALUE': function() {
                    XT.setDisplay('full', 'foo');
                }
            }
        },
        knob: {
            'CH8': {
                right: function() { updateKeyDisplay(1); },
                left: function() { updateKeyDisplay(-1); }    
                }
            }
        },
    'F2': {
        button: {
            up: {
                'NAME/VALUE': function() {
                    setMidiTest(true);
                }
            }
        },
        knob: {
            'CH6': {
                right: function(){ updateMidiDisplay(1,0,0); },
                left: function(){ updateMidiDisplay(-1,0,0); },
            },
            'CH7': {
                right: function(){ updateMidiDisplay(0,1,0); },
                left: function(){ updateMidiDisplay(0,-1,0); },
            },
            'CH8': {
                right: function(){ updateMidiDisplay(0,0,1); },
                left: function(){ updateMidiDisplay(0,0,-1); },
            },

        }
    },
    'F3': {
        button: {
            up: {
                'CH8.SELECT': function() {
                    XT.clearSignalHold('CH8');
                },
                'CH8.MUTE': function() {
                    XT.clearSignalHold('CH8');
                },
                'CH8.SOLO': function() {
                    XT.clearSignalHold('CH8');
                },
                'CH8.REC': function() {
                    XT.clearSignalHold('CH8');
                },
            },
           down: {
                'CH7.SELECT': function() {
                    XT.setSignalLevel('CH7', 1);
                },
                'CH7.MUTE': function() {
                    XT.setSignalLevel('CH7', 5);
                },
                'CH7.SOLO': function() {
                    XT.setSignalLevel('CH7', 8);
                },
                'CH7.REC': function() {
                    XT.setSignalLevel('CH7', 'CLEAR');
                },  
                'CH8.SELECT': function() {
                    XT.holdSignalLevel('CH8', 1);
                },
                'CH8.MUTE': function() {
                    XT.holdSignalLevel('CH8', 3);
                },
                'CH8.SOLO': function() {
                    XT.holdSignalLevel('CH8', 5);
                },
                'CH8.REC': function() {
                    XT.holdSignalLevel('CH8', 8);
                }

            }
        }
            
    },
    'F4': {
        fader: function(name, state) { 
            showFaderVal(name, state); 
        }
    },
    'F5' : {
        knob: function(name, state) { showKnobValue(name, state); }
    }
});

//this is all the controls that aren't impacted by the function mode
XT.controlMap({
    group: {
        mode: function(name) { 
            setupMode(name); 
            XT.mode(name);
            
        }   
    },
    
    toggle: {
        'FLIP': {
            'activate': function() { autoMidi = true; },
            'deactivate': function() { autoMidi = false; },
        }
    },

    button: {
        down: {
            'TRACK': function() {
                console.log('CLEAR DISPLAY');
                XT.clearDisplay(true); 
                XT.showTempMessage('clear disp');
            },
            'PAN/SURROUND': function() {
                console.log('CLEAR BUTTON LIGHTS');
                XT.showTempMessage('no btn lts');
                XT.setAllButtonLights('off');
            },
            'EQ': function() {
                console.log('CLEAR DISPLAY LIGHTS');
                XT.showTempMessage('Disp light');
                XT.setAllDisplayLights('off');
            },
            'SEND': function() {
                console.log('RESET KNOB MODES');
                XT.showTempMessage('clear knob');
                XT.clearKnobModes();
            },
            'PLUG-IN': function() {
                console.log('SET FADERS TO -infinity');
                XT.showTempMessage('fdr = -inf')
                XT.resetFaders(false);
            },
            'INST': function() {
                console.log('SET FADERS TO unity');
                XT.showTempMessage('fdr = unty');
                XT.resetFaders(true);
            } 
        }
    }
});

/**********************************************************************/
/**********************************************************************/
/**********************************************************************/

function processAction(action) {
    
}




