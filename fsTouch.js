/* jshint esversion:6 */

var xt = require('./index');

xt.on('error', (err) => {
    console.log('ERROR: ' + err);
});

xt.on('debug', (msg) => {
    //console.log(':>' + msg);
});

xt.start((msg) => {
    console.log('FSTouch Started: ' + msg);
    startup();
});



var radios = {
    'NAV1': {
        active: 100.0,
        standby: 100.0    
    },
    'NAV2': {
        active: 100.0,
        standby: 100.0    
    },

    'COM1': {
        active: 100.0,
        standby: 100.0    
    },
    'COM2': {
        active: 100.0,
        standby: 100.0    
    },
};

var ap = {
    active: false,
    mode: 'HDG',
    altHold: false,
    VSPEED: 0,
    ALT: 0,
    HDG: 0
};




function startup() {
    xt.setAutoButtonLights(true, [
        'TRACK',
        'PAN/SURROUND',
        'EQ'
    ]);
    
    xt.addGroup('mode', {
        members: [
            'MIDI TRACKS',
             'INPUTS',
             'AUDIO TRACKS',
             'AUDIO INST',
             'AUX',
             'BUSES',
             'OUTPUTS',
             'USER'
        ]
    });

    xt.clearDisplay();
    xt.setDisplay('full', 'Ready');

    xt.clearKnobModes();
    xt.setAllDisplayLights('off');
}



/******************************************************************/
function setMode(mode) {
    xt.clearDisplay();
    xt.clearKnobModes();
    xt.setAllDisplayLights('off');

    xt.mode(mode);
    if (mode === 'NAV1' ||
        mode === 'NAV2' ||
        mode === 'COM1' ||
        mode === 'COM2') {
            xt.setKnobLight('CH7', 'all', 'on');
            xt.setKnobLight('CH8', 'all', 'on');
            xt.setDisplayLight('SOLO', 'on');
            showRadio(radios[mode]);
    } else if (mode === 'NULL') {
        xt.setDisplay('full', 'NO FUNC');
    } else if (mode === 'ALT') {
        xt.setKnobLight('CH7', 'all', 'on');
        xt.setKnobLight('CH8', 'all', 'on');
        showAPValue();
        xt.setDisplay(['BARS'], 'alt');
    } else if (mode === 'HDG') {
        xt.setDisplay(['BARS'], 'hdg');
        xt.setKnobLight('CH8', 'all', 'on');
        showAPValue();
    } else if (mode === 'VSPEED') {
        xt.setDisplay(['BARS'], 'vs');
        xt.setKnobLight('CH8', 'all', 'on');
        showAPValue();
    }

    if (mode === 'NAV1') { 
        xt.setDisplay('ASSIGNMENT', 'N1');    
    } else if (mode === 'NAV2') {
        xt.setDisplay('ASSIGNMENT', 'N2');
    } else if (mode === 'COM1') {
        xt.setDisplay('ASSIGNMENT', 'C1');
    } else if (mode === 'COM2') {
        xt.setDisplay('ASSIGNMENT', 'C2');
    }
}
/******************************************************************/

function showAPValue() {
    var mode = xt.mode();
    xt.setDisplay(
        ['BEATS', 'SUB DIVISION', 'TICKS'],
        ap[mode],
        true
    );
}

function updateAP(val) {
    mode = xt.mode();
    ap[mode] += val;

    if (mode === 'HDG' && ap.HDG === 360) { ap.HDG = 0; }
    else if (mode === 'HDG' && ap.HDG === -1) { ap.HDG = 359; }

    showAPValue();
}

function showRadio(radio) {
    xt.setDisplay(['BARS','BEATS'], radio.standby, false, 1);
    xt.setDisplay(['SECONDS','FRAMES'], radio.active, true, 1);
}

function updateRadio(radio, val) {
    radio.standby += val;
    showRadio(radio);
}

function setRadio() {
    var name = xt.mode();
   

    if (name.indexOf('NAV') > -1) {
        xt.setDisplay('full', 'set nav...');
    } else {
        xt.setDisplay('full', 'set com...');
    }
    swapRadio(radios[name]);
    setTimeout( () => { showRadio(radios[name]); }, 1000); 
}


function swapRadio(radio) {
    var tempVal = 0;
    tempVal = radio.standby;
    radio.standby = radio.active;
    radio.active = tempVal;
}


xt.controlMap({
    group: {
        mode: {
            'MIDI TRACKS': function() { setMode('NAV1'); },
            'INPUTS': function() { setMode('NAV2'); },
            'AUDIO TRACKS': function() { setMode('COM1'); },
            'AUDIO INST': function() { setMode('COM2'); },
            'AUX': function() { setMode('NULL'); },
            'BUSES': function() { setMode('VSPEED'); },
            'OUTPUTS': function() { setMode('HDG'); },
            'USER': function() { setMode('ALT'); },
        }
    },

    button: {
        up: {
            //DEBUG CLEAR LIGHTS/DISPLAY
            'TRACK': function() { xt.clearDisplay(); },
            'PAN/SURROUND': function() { xt.setAllButtonLights('off'); },
            'EQ': function() { xt.clearKnobModes(); }
        }
    }
});

xt.modeMap( {
    'NAV1': {
        knob: {
            'CH7': {
                'right': function() { updateRadio(radios.NAV1, 1); },
                'left': function() { updateRadio(radios.NAV1, -1); }
            },
            'CH8': {
                'right': function() { updateRadio(radios.NAV1, 0.5); },
                'left': function() { updateRadio(radios.NAV1, -0.5); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setRadio(); }
            }
        }
    },
    'NAV2': {
        knob: {
            'CH7': {
                'right': function() { updateRadio(radios.NAV2, 1); },
                'left': function() { updateRadio(radios.NAV2, -1); }
            },
            'CH8': {
                'right': function() { updateRadio(radios.NAV2, 0.5); },
                'left': function() { updateRadio(radios.NAV2, -0.5); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setRadio(); }
            }
        }
    },
    'COM1': {
        knob: {
            'CH7': {
                'right': function() { updateRadio(radios.COM1, 1); },
                'left': function() { updateRadio(radios.COM1, -1); }
            },
            'CH8': {
                'right': function() { updateRadio(radios.COM1, 0.5); },
                'left': function() { updateRadio(radios.COM1, -0.5); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setRadio(); }
            }
        }
    },
    'COM2': {
        knob: {
            'CH7': {
                'right': function() { updateRadio(radios.COM2, 1); },
                'left': function() { updateRadio(radios.COM2, -1); }
            },
            'CH8': {
                'right': function() { updateRadio(radios.COM2, 0.5); },
                'left': function() { updateRadio(radios.COM2, -0.5); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setRadio(); }
            }
        }
    },
    'ALT': {
        knob: {
            'CH7': {
                'right': function() { updateAP(1000); },
                'left': function() { updateAP(-1000); }
            },
            'CH8': {
                'right': function() { updateAP(100); },
                'left': function() { updateAP(-100); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setAPValue(); }
            }
        }
    },
    'HDG': {
        knob: {
            'CH8': {
                'right': function() { updateAP(1); },
                'left': function() { updateAP(-1); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setAPValue(); }
            }
        }
    },
    'VSPEED': {
        knob: {
            'CH8': {
                'right': function() { updateAP(100); },
                'left': function() { updateAP(-100); }
            }
        },
        button: {
            up: {
                'NAME/VALUE': function () { setAPValue(); }
            }
        }
    },
});