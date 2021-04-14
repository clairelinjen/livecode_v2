var livecode;       // textarea
var playbutton;
var stopbutton;
var errorbox;
var score = [];     // arr of ReadLine objects
var loops = {};
var activeKeys = [];
var beat = 1.5;
var on = false;

function midiToFreq(m) {
    return Math.pow(2, (m - 69) / 12) * 440;
}

document.addEventListener("DOMContentLoaded", function(event) {

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    livecode = document.getElementById("livecode");
    playbutton = document.getElementById("play");
    playbutton.addEventListener("click", change);
    stopbutton = document.getElementById("stop");
    stopbutton.addEventListener("click", stopPlaying);
    errorbox = document.getElementById("er");

    var comp = audioCtx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, audioCtx.currentTime);
    comp.connect(audioCtx.destination);

    class Loop{
        constructor(readline){
            this.notes = readline.notes;
            this.osc = audioCtx.createOscillator();
            this.gain = audioCtx.createGain();
            this.nextNote = 0;
            this.lastNoteEnd = 0;
            this.setUp();
        }

        setUp(){
            this.osc.connect(this.gain).connect(comp);
            this.gain.gain.setValueAtTime(0, audioCtx.currentTime);
            this.osc.start();
        }
    }

    function updateScore(){
        score = [];
        errorbox.innerHTML = "";
        var lines = livecode.value.split("\n");
        var keys = {};
        for(let i = 0; i < lines.length; i++){
            if (lines[i].replace(/\s/g, '').length) {
                var l = new ReadLine(lines[i]); // in readline.js
                if (l.errors.length>0){
                    error(l.errors, i+1);
                }
                else if (l.key in keys){
                    error(["Duplicate key \'"+l.key+"\'",], i+1);
                }
                else{
                    score.push(l);
                    keys[l.key] = true;
                }
            }
        }
        console.log(score);
    }

    function error(arr, l){
        for (let i=0; i < arr.length; i++){
            var error = "ERROR: Line "+l+" - "+arr[i]+"<br>";
            errorbox.innerHTML += error;
        }
    }

    function change(){
        updateScore();
        var newKeys = [];
        for (let i = 0; i < score.length; i++){
            var line = score[i];
            if (activeKeys.includes(line.key)){
                loops[line.key].notes = line.notes;
                loops[line.key].newBeats = line.beats;
            }
            else{
                loops[line.key] = new Loop(line);
            }
            newKeys.push(line.key);
        }
        for (let i=0; i < activeKeys.length; i++){
            if (!newKeys.includes(activeKeys[i])){
                loops[activeKeys[i]].notes = [];
            }
        }
        activeKeys = newKeys;
    }

    function stopPlaying(){
        for (let i=0; i < activeKeys.length; i++){
            loops[activeKeys[i]].del = true;
        }
        activeKeys = [];
        score = [];
    }

    function scheduleNote(key){
        var loop = loops[key];
        var start = loop.lastNoteEnd;
        if (loop.nextNote > loop.notes.length - 1){
            loop.nextNote = 0;
        }
        var index = loop.nextNote;
        var note = loop.notes[index][0];
        var dur = beat / loop.notes[index][1];
        var g = loop.gain;
        if (note != null && note !== "x"){
            g.gain.setValueAtTime(0,start);
            loop.osc.frequency.setValueAtTime(midiToFreq(note), start);
            g.gain.linearRampToValueAtTime(.8, start + dur/9);
            g.gain.setValueAtTime(.8, start + 8*dur/9);
            g.gain.linearRampToValueAtTime(0, start + dur);
        }
        else{
            g.gain.setValueAtTime(0,start + dur);
        }
        loop.nextNote += 1;
        loop.lastNoteEnd += dur;
    }

    var nextBeat = audioCtx.currentTime;

    function scheduler() {
        while (nextBeat < audioCtx.currentTime + 0.1) {
            nextBeat += beat;
            for (var key in loops){
                if (loops[key].notes === null){
                    loops.delete(key);
                    continue;
                }
                if (loops[key].lastNoteEnd === 0){
                    loops[key].lastNoteEnd = nextBeat -= beat;
                }
                while (loops[key].lastNoteEnd < nextBeat) {
                    scheduleNote(key);
                }
            }
        }

        timerID = window.setTimeout(scheduler, 30.0);
    };

    scheduler();

});

