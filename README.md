# jw-xtouch
Wrapper for the Behringer X-Touch control surface over MIDI. Currently supports all features except the scribble strips. X-Touch needs to be in Mackie Control over USB.

Simple use example, this will initialize the controller and make the 'SCRUB' button blink when it is pressed:

```javascript
var xt = require('jw-xtouch');

xt.on('action', (action) => {
    if (action.name === 'SCRUB' &&
        action.state === 'up') {
        xt.setButtonLight('SCRUB', 'blink');
    }
});

xt.start();
```
There are two intended ways of working with the X-Touch: 
1. Responding to emitted 'action' events.
2. Using the controlMap object to represent what actions should be taken when they occur. The added benefit of using this modality is that it also allows for an intuitive way to change what keys/faders/knobs do when in different modes, i.e. changing a knob from a pan to a level control.

You can use both methods simultaneously. If you handle the same control both ways both things will happen. In other words the controlMap does not stop the emitter from firing. So for example if you want to use the controlMap for everything but the faders and use the emitter to set the faders that is perfectly reasonable, though as you'll see from the below examples you can actually use the controlMap to pass all the faders to your own function with a similar amount of code as would be needed to use the emitter. Feel free to mix and match as you see fit.

Here is an example written in both ways that will illuminate several buttons after they are pressed:

```javascript
//Emitter mode:
xt.on('action', (action) => {
    if (action.control === 'button') {
        if (action.state === 'up') {
            if (action.name === 'SCRUB') { xt.setButtonLight('SCRUB', 'on'); }
            else if (action.name === 'FLIP') { xt.setButtonLight('FLIP', 'on'); }
            else if (action.name === 'MARKER') { xt.setButtonLight('MARKER', 'on'); }
            else if (action.name === 'NUDGE') { xt.setButtonLight('NUDGE', 'on'); }  
        }
    }
});

//vs controlMap mode:
xt.controlMap({
   'button': {
       'up': {
           'SCRUB': function() { xt.setButtonLight('SCRUB', 'on'); },
           'FLIP': function() { xt.setButtonLight('FLIP', 'on'); },
           'MARKER': function() { xt.setButtonLight('MARKER', 'on'); },
           'NUDGE': function() { xt.setButtonLight('NUDGE', 'on'); },
       }
   } 
});

```
Either method is fine for simple and similar actions, but when you want to do different things with different buttons emitter mode starts to become unwieldy. In this next example we are going to add only one extra button behavior and one knob behavior, but you can start to see how complex it starts to get using the emitter mode:

```javascript
//Emitter mode:
xt.on('action', (action) => {
    if (action.control === 'button') {
        if (action.state === 'up') {
            if (action.name === 'SCRUB') { xt.setButtonLight('SCRUB', 'on'); }
            else if (action.name === 'FLIP') { xt.setButtonLight('FLIP', 'on'); }
            else if (action.name === 'MARKER') { xt.setButtonLight('MARKER', 'on'); }
            else if (action.name === 'NUDGE') { xt.setButtonLight('NUDGE', 'on'); }  
        } else if (action.state === 'down' && action.name === 'SCRUB') {
            xt.setButtonLight('SCRUB', 'blink');
        }
    } else if (action.control == 'knob') {
        if (action.name === 'CH1') {
            if (action.state === 'right' ) { myPanVar += 1; }
            else { myPanVar -=1; }
        }
    }
});

//vs controlMap mode:
xt.controlMap({
   'button': {
       'up': {
           'SCRUB': function() { xt.setButtonLight('SCRUB', 'on'); },
           'FLIP': function() { xt.setButtonLight('FLIP', 'on'); },
           'MARKER': function() { xt.setButtonLight('MARKER', 'on'); },
           'NUDGE': function() { xt.setButtonLight('NUDGE', 'on'); },
       },
       'down': {
           'SCRUB': function() { xt.setButtonLight('SCRUB', 'blink'); }
       }
   },
   'knob': {
       'CH1': {
           'right': { myPanVar += 1; },
           'left': { myPanVar -=1; }
       }
   } 
});
```

As you can see with this small example that only used 4 buttons and 1 knob how much simpler and more readable the controlMap method is. Don't forget: the X-Touch has over 90 buttons, 8 knobs, 9 faders and a jog/shuttle wheel, imagine how complex and unreadable your nested conditionals will become!

You can use various structures to organize the controlMap to set it up in the most readable way for your needs. The software will find your function regardless. Ex:

```javascript
xt.controlMap({
    button: {
        //first by the name, then the state
        //useful when each control does multiple things
        'SCRUB': {
            'down': function() { xt.setButtonLight('SCRUB', 'on'); }
            'up': function() { xt.setButtonLight('SCRUB', 'off'); }
        },
        //now by the state, then the name
        //useful when you only want to respond to one state 
        'up': { 
            'SHIFT': function() { doMyShiftFunc(); },
            'OPTION': function() { doMyOptionFunc(); }
        }
    },

    //now just by the type and the name, passing the state to the function
    //this is basically required for faders since they emit 100s of different states 
    fader: { 
        'CH1': function() { updateLeftSpeaker(state); },
        'CH2': function() { updateRightSpeaker(state); }, 
    }

    //now just by the control type, passing the name and the state
    //useful when you want to take care of everything inside your own function
    knob: function() { updatePan(name, state); }
});
```

In fact even if you want to handle 100% of the controls inside your own function you can still use the controlMap. While this may be more verbose, it does allow for different modes (see below)

```javascript
//emitter mode:
xt.on('action', (action) => {
    processAction(action);
});

//controlMap mode:
xt.controlMap({
    'button': function() { processButtons(name, state); },
    'knob': function() { processKnobs(name, state); },
    'fader': function() { processFaders(name, state); },
    'jog/shuttle': function() { processJog(name, state); }
});

```


The other advantage of the controlMap method is that there is built-in support for different modes, so for example if we wanted the SCRUB and FLIP buttons to blink only while in 'edit' mode but have the same behavior as the other buttons otherwise we can do it like this:

```javascript
xt.controlMap({
   'button': {
       'up': {
           'SCRUB': function() { xt.setButtonLight('SCRUB', 'on'); },
           'FLIP': function() { xt.setButtonLight('FLIP', 'on'); },
           'MARKER': function() { xt.setButtonLight('MARKER', 'on'); },
           'NUDGE': function() { xt.setButtonLight('NUDGE', 'on'); },
       }
   } 
});

xt.modeMap({
    'edit': { //this is the mode
        'button': {
            'up': {
                'SCRUB': function() { xt.setButtonLight('SCRUB', 'blink'); }, 
                'FLIP': function() { xt.setButtonLight('FLIP', 'blink'); }, 
            }
        }
    }
});

xt.setMode('edit');

```
The software will check the modeMap before the control map and use that action if one is found.


There are also a few 'convenience' functions that create virtual controls:
1. Toggles - a single button that illuminates when pressed and turns off when pressed again, can be set to blink.
2. Groups - a set of buttons where only one will be illuminated at once.
3. Knob modes - the lights around the knobs will illuminate in different ways and the knobs will emit different states based on the mode.
4. Automatic button lights - this will make the buttons illuminate only when pressed to give some user feedback. Purely cosmetic, doesn't change what the buttons emit.

When you assign buttons and knobs to toggles/groups/knob modes they no longer emit their standard actions, instead they will emit what is appropriate for the virtual control. For toggles and groups their type also becomes 'toggle' or 'group'. So for toggles they emit 'activate'/'deactivate', for groups they emit the name of the button pressed and for knob modes they emit various numbers representing their value. See detailed information below.

# Naming conventions and states:

## Faders 

__Naming:__
CH1 - CH8, MAIN

__States:__ 
touch/release/a number representing the value of the fader

## Knobs (the dials at the top of the X-Touch)

__Naming:__
CH1 - CH8

__States:__
up/down/left/right/a number representing the value of the knob based on its mode (right is clockwise)

## Buttons

__Naming:__  
With some exceptions the name of the button is exactly what is printed _under_ the button on the X-Touch. So for example the buttons in the "Encoder Assign" section are: 'TRACK', 'PAN/SURROUND', 'EQ', 'SEND', 'PLUG-IN', 'INST'. If the button text has a space or a newline then the button name will also have a space: 'GLOBAL VIEW', 'MIDI TRACKS', etc.

__Exceptions__:
* The buttons between the knobs and faders are referred to as 'CH1.REC', 'CH1.SOLO', 'CH1.MUTE', 'CH1.SELECT', 'CH2.REC', 'CH2.SOLO', etc.
* The transport controls are 'REW', 'FWD', 'STOP', 'PLAY', 'REC'
* The "Fader Bank" and "Channel" buttons are 'FADER BANK LEFT', 'CHANNEL RIGHT', etc.
* The "D-Pad" next to the jog/shuttle wheel is 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER'
* The button in the "Modify Group" section labeled '¤/ALT' is just 'ALT' for simplicity's sake.

__States:__  
up/down 

## Jog/Shuttle - the wheel in the bottom-right
Note that the control is type jog/shuttle and it's name is JOG/SHUTTLE for case consistency with other controls/names

__States:__  
right/left

## Display - the alpha-numeric display at the top-right of the unit

__Naming__: 
You can use the labels on the top or bottom, so the second display section can be referred to as either 'HOURS' or 'BARS' for example. 

# Functions

* __start(options):__  
Starts the midi controller.  
-options (optional) =  { port:number } - the number of the midi port  
Notes: the controller will attempt to determine which port the midi controller is on automatically
* __stop():__  
Stops the midi controller.
* __getPorts():__  
Returns a string array of the available ports
* __on(event, callback):__  
Creates an event listener.  
-event{string}, the event to listen for. 'action/error/debug'
Notes: error and debug callback with a string, action calls back with an action object.  
Action object:
``` Javascript
    {
        control: 'button/knob/fader',
        name: 'the name of the control',
        state: 'up/down/left/right' || 'value{number}'
    }
```
* __setButtonLight(name, state):__  
Turns the button lights on or off or blinking  
-name{string} - the name of the button  
-state{string} - the state of the light: 'on/off/blink'
* __setAllButtonLights(state):__
Turns all the button lights on or off or blinking  
-state{string} - the state of the light: 'on/off/blink'
* __setDisplay(elementName, value, rightAlign, toFixed):__  
Sets the value of the display elements on the top-right of the X-Touch  
-elementName{string|array} - the name of the display element or an array of elements if you want to group them into a single element. If not provided then the entire display will be used. If you send 'full' then all the display elements to the right of the dash will be used. You may also specify 'all' to use the entire display. 
-value{string|number|array} - the value you want to display.  
-rightAlign{bool} - right align the value in the available space
-toFixed{number} - sets a fixed number of decimal places. It is strongly recommended that this be set when decimals may be encountered in your output or the display might behave oddly, see https://stackoverflow.com/questions/1458633/how-to-deal-with-floating-point-number-precision-in-javascript Even without floating point issues it will probably look best to always set a fixed decimal value for your numbers or they will bounce around on the display as the decimal comes and goes.

NOTES: Floating point numbers do not use up a display slot, so 4.7 will only take up 2 slots. If you send an array you have full control of what goes in each space. So if you send ['A','OFF,'B] it will display 'A_B' where the underscore represents a blank. To send a decimal manually do it like this: ['3.',2] which will display '3.2'. To just send a dot/decimal send it as a string:  '.' Here is an example where the individual elements are separated by | in the output comments

```javascript
xt.setDisplay('full', 3.2 , true, 1);
//Output: | | | | | | | | |3.|2|
xt.setDisplay('full', '3.2' , false, 1);
//Output: |3.|2| | | | | | | | |
xt.setDisplay('full', [3,'.',2] ,false);
//Output: |3|.|2| | | | | | | | -note the extra space taken up by the .
XT.setDisplay('full', 'foo bar');
//Output: |f|o|o| |b|a|r| | | | 

```
 
* __sendRaw(triplet):__  
Sends a raw midi command to the controller  
-triplet{array} - the command to send,
EX:
```Javascript
    xt.sendRaw([144, 101, 127]);
    //Turns the light in the 'SWAP' button on
```
* __addToggle(name, toggle):__  
Turns a button into a toggle that automatically lights up when pressed.  
-name{string} - the button name  
-toggle{object}: - information about the toggle
```Javascript
    {
        state: 'on/off', //the initial state
        blink: true //this toggle should blink when it's pressed
    }
```
* __setToggle(name, state, noCallback):__  
Sets the state of an existing toggle  
-name{string} - the name of the button  
-state{string} - 'on/off'  
-noCallback{boolean} - by default setting the state via code will execute the callback (only on change), set this true and the callback wont run.  
NOTES: you can set a normal toggle to a blink toggle by sending 'blink' as the state. If the toggle was previously on this isn't considered a change. 

* __addGroup(name, group):__  
Adds a group, a series of buttons where only one can active at any time.  
-group{object} - information about the group  
Example:
```Javascript
    xt.addGroup('mode',{
        members: ['F1','F2','F3'],
        activeButton: 'F1'
    });
```
NOTES:  
-this will setup the first 3 "F" buttons as a group for changing a hypothetical mode.  
-name: the name of the group  
-members: the buttons that are part of the group  
-activeButton: 'F1' sets F1 active when you declare the group, this is optional.    


* __setGroup(name, button, noCallback):__  
Sets the state of an existing group  
-name{string} - the name of the group to modify  
-button{string} - the new button to be active  
-noCallback{bool} - if true then the onChange callback wont run
</br>
* __clearDisplay(force):__
Clears the entire display
-force{boolean} by default the display keeps track of what is in each element and only updates them if they change. If force=true then each element will be reset to blank even if it is already blank. This should in theory never be necessary.  
</br> 

* __removeToggle(name):__  
Removes an existing toggle
-name{string} - the name of the button to remove the toggle from
</br> 
 
* __removeGroup(name):__
Removes an existing group
-name{string} - the name of the existing group
</br> 

* __setFader(fader, value):__
Sets the position of a fader based on its mode and resolution
-fader{string} - the name of the fader
-value{number} - the new value/position of the fader  
NOTES:  
This is not super-accurate and needs improvement. In decibel mode near unity it works fine but if you send -30 in decibel mode and then touch the fader it will probably register that it's at -29 or -31 or something like that. Since it's not that accurate to begin with when you are in position mode it only uses 7-bit precision regardless of how high you set the resolution.
</br> 

* __setKnobLight(knob, mode, value, showSideLights):__
Turns on the lights that ring the knobs. Uses the same names and values from the knob modes.
-knob{string} - the name of the knob
-mode{string} - the mode of the lights, normal/sequence/level/fill
-value{number} - the value associated with the mode
-showSideLights{boolean} - if true the leftmost and rightmost lights will also illuminate
</br> 

* __setKnobMode(knob, mode, sideLights, value):__
Set the mode for a knob and it's initial value. When set to a mode the knob's lights change automatically based on their value and they emit appropriate values.
-knob{string} - the name of the knob
-mode{string} - the mode, see notes for explanation
-sideLights{boolean} - if true the leftmost and rightmost lights will also illuminate while the knob is in a mode
-value{number} - the initial value  
 
Modes:
1) normal: this is "no mode" i.e. the knob does not do anything special
2) sequence: a single light illuminates from left to right as the knob is turned. Values: 1-11 (one light will always be lit)
3) level: the lights turn on and stay on as you rotate the knob. Values: 0-11 (when set to 0 no lights will light)
4) pan: the center light is always illuminated and the lights turn on and stay on either to the left or right of center as you rotate the knob. Values -5 - 5
5) fill: the center light is always on and as you rotate clockwise the left and right lights turn on and stay on. Values: with side lights = 1-6, without sidelights = 1-7 (the 7th value lights the side-lights)

</br> 

* __clearKnobModes:__
Resets the knobs to their normal functionality, emitting just left/right/up/down and no lights lighting. To reset a signal knob set its mode to "normal".
</br> 

* __setDisplayLight(name, state):__
Turns on/off/blink the lights in the display area
-name{string} - the name of the light SOLO/SMPTE/BEATS
-state{string} - the state of the light on/off/blink
</br> 

* __setAllDisplayLights(state):__
Set all the display indicator lights on/off/blink
-state{string} - the new state
</br> 

* __resetFaders(unity):__
Moves all fader to either -infinity (-100) or unity (0) regardless of their mode or resolution
-unity{boolean} - if true then sets to unity otherwise to -infinity (all the way down)

</br> 

* __setFaderMode(fader, mode, resolution):__
Set the mode (decibel/position) and resolution of an individual fader
-fader{string} - the name of the fader
-mode{string} - the mode decibel/position
-resolution{number} - the resolution, see notes  
NOTES:    
In position mode the resolution should be a whole number representing the min-max value the fader will return when it's moved from the bottom to the top. In decibel mode the resolution is a fraction or whole number, such as 0.5 to return half-decibel changes. Decibel mode always returns the values printed on the fader.
As best I can determine the physical faders theoretically output in 14-bit resolution but in practice it's closer to 10 bits (1024) and really only consistently accurate to 7 bits (128). I'd recommend setting the position resolution to 100, 128, 256 or at most 512 (there's no technical reason to use powers of two honestly, 500 or 398 or 7 are all perfectly fine resolution values).
In decibel mode the scale isn't linear, with much more physical space near unity (0) then there is closer to -infinity so if you set the resolution to 0.125 or something very precise like that you will only get those small fractions near unity. I'd recommend not using precision below 0.5 but you may use: 0.1, 0.125, 0.25, 0.5, 1, 5, or 10. If you do use a more precise resolution then 0.5 you wont get each value in sequence (0.125, 0.25. 0.375, etc.) instead it will almost always skip since it isn't really that accurate.
It should also be noted that depending on the mode/resolution the fader may return a higher number then your max. This has to do with the analog nature of the physical fader, so program your solution accordingly.
</br> 

* __setSignalLevel(channel, level):__
Set the signal level indicator for a channel. By default the X-Touch will only light the signal for a moment and then show it dropping off.  
-channel{string} - the channel name  
-level{number} - the level, 0-8. 8 will illuminate the clip light until you set the signal to 0.  
</br> 

* __clearSignalBars():__
If you send the max value to a signal bar it will illuminate the "clip" light permanently. This will clear all of those indicators. To clear a single signal use setSignalLevel(channel, 0)
</br> 

* __holdSignalLevel(channel, level):__
This will hold the signal level for the given value. It does this by sending the signal level several times a second, so it is recommended not to use this for more then one or two channels at a time because it will saturate the midi communication. Quite frankly you probable shouldn't use it at all.  
-channel{string} - the channel
-level{number} - the level, 1-8
</br> 

* __clearSignalHold(channel):__
Will stop a signal hold for the given channel
-channel{string} - the channel
</br> 

* __setAutoButtonLights(shouldAutoLight, buttonNames):__
Another convenience feature, this will cause the named buttons to illuminate only while they are pressed down. It doesn't change any other behavior. Useful when you just want to let the user know that the button was pressed. It actually leaves the button illuminated for a very short time after it is released to help give better visual feedback.
-shouldAutoLight{boolean} - false will clear a previously set light
-buttonNames{string} - 'all' will make every button auto-light. May also send a single button name or a list of button names
Example:
```javascript
//make the FLIP button light when pressed
xt.setAutoButtonLight(true, 'FLIP'); 

//make the "d-pad" next to the jog/shuttle wheel light when pressed
xt.setAutoButtonLight(true, 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER');
```
</br> 

* __showTempMessage(message, delay):__
Will show a temporary message on the display for a given time. Afterwords the display will show what it did before. Useful when you want to communicate an event to the user. It only uses the contiguous ("full") display elements.
-message{string} - the message to display (10 chars)
-delay{number} - number of milliseconds to display the message, default=1000
</br> 

* __controlMap(map):__
Used to set or return the control map
-map{object} - the map
</br> 

* __modeMap(map):__
Used to set or return the mode map
-map{object} - the map
</br> 

* __mode(mode):__
Used to set or return the mode used by the mode map.
-mode{string} - the new mode



