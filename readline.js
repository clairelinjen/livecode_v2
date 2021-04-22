music_rnn = new mm.MusicRNN("https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn");
music_rnn.initialize();



class ReadLine {
    constructor(line){
        this.key = "";
        this.errors = [];
        this.arr = this.scan(line.split(""));
        if (this.errors.length === 0){
            this.setValues();
        }
    }

    scan(l){
        var temp = [];
        var arr = [];
        var symbolcount = 0;
        var notecount = 0;

        while (l.length > 0){
            var c = l.shift();
            if (c === "="){
                if (temp.length > 0){
                    this.key = temp.join("");
                    temp = []
                }
                else{
                    this.key = arr.pop();
                }
                if (arr.length > 0){
                    this.errors.push("Key cannot contain spaces");
                    break;
                }
            }
            else if (c === "*"){
                if (temp.length > 0){
                    temp.push(c);
                    arr.push(temp.join(""));
                    temp = [];
                }
                else{
                    arr[arr.length -1] = arr[arr.length -1].concat(c);
                }
                symbolcount += 1;
            }
            else if (c === " "){
                if (temp.length > 0){
                    arr.push(temp.join(""));
                    temp = [];
                }
            }
            else if (c === "(" || c === ")"){
                if (temp.length > 0){
                    arr.push(temp.join(""));
                    temp = [];
                }
                arr.push(c);
                symbolcount += 1;
            }
            else{
                temp.push(c);
                notecount += 1;
                if (c === '-'){
                    notecount -= 1;
                }
                if(c === 'x'){
                    if (notecount <= 1){
                        this.errors.push("Number of notes before x must be greater than 1");
                        break;
                    }
                }
            }
        }
        arr.push(temp.join(""));
        if (this.key === ""){
            this.errors.push("Missing key")
        }
        return arr;
    }

    setValues(){
        var result = this.noteSchedule(this.arr);
        if (this.errors.length > 0){
            this.key = "";
        }
        else{
            this.notes = result[0];
            this.generate(0);
            // a 'note' is a length 2 array, note[0] is freq, note[1] is denominator of the fraction of the beat
            // [440, 2] means the note is 440 hz and lasts half a beat
        }
    }

    noteSchedule(arr){
        var schedule = [];
        var beats = 0;

        while (arr.length > 0){
            var curr = arr.shift();
            if (curr === ""){
                //continue
            }
            else {
                var c = this.specialChar(curr, arr);
                if (c != null) {
                    schedule = schedule.concat(c[0]);
                    beats += c[1];
                    arr = c[2];
                } else {
                    var n = parseInt(curr);
                    if (isNaN(n) || n < 0 || n > 127) {
                        if (curr === "x"){
                            schedule.push(["x", 1]);
                        }
                        else{
                            if (curr === "-"){
                                schedule.push([null, 1]);
                            }
                            else{
                                this.errors.push("\'"+curr+"\' is undefined")
                                break;
                            }
                        }
                    } else {
                        schedule.push([n, 1]);
                    }
                    beats += 1;
                }
            }
        }
        return [schedule, beats, arr]
    }

    specialChar(curr, arr){
        if (curr === "("){
            return this.group(arr);
        }
        else if (curr.slice(curr.length-1) === '*'){
            return this.sequence(curr, arr);
        }
        else{
            return null;
        }
    }

    sequence(curr, arr){
        var fit = false;
        var mult = 1;
        var beats = 1;
        if (curr.slice(curr.length-2) === '**'){
            fit = true;
            mult = parseInt(curr.slice(0,curr.length-2));
        }
        else{
            mult = parseInt(curr.slice(0,curr.length-1));
            beats = mult;
        }

        var notes = [];
        curr = arr.shift();
        if (curr === "(") {
            var g = this.group(arr);
            for (let i = 0; i < mult; i++) {
                notes = notes.concat(g[0]);
            }
            arr = g[2];
        }
        else {
            var a = [];
            for (let i = 0; i < mult; i++) {
                a.push(curr);
            }
            var sch = this.noteSchedule(a);
            notes = sch[0];
        }

        if (fit){
            for (let i = 0; i < notes.length; i++){
                notes[i][1] *= mult;
            }
        }
        return [notes, beats, arr]
    }

    group(arr){
        var gr = [];
        var curr = arr.shift();
        var ins = [];
        var index = -1;
        var addBeats = 0;
        while (arr.length > 0 && curr !== ")"){
            gr.push(curr);
            curr = arr.shift();
            var c = this.specialChar(curr,arr);
            if (c != null){
                ins = c[0];
                addBeats = c[1];
                arr = c[2];
                curr = arr.shift();
                index = gr.length;
            }
        }

        var notes = [];
        var beats;
        if (arr.length === 0 && curr !== ")"){
                // should throw an error
            beats = 0;
        }
        else{
            var sch = this.noteSchedule(gr);
            for (let i = 0; i < sch[0].length; i++){
                if (i === index){
                    notes = notes.concat(ins);
                }
                notes.push(sch[0][i])
            }
            if (index === notes.length){
                notes = notes.concat(ins);
            }
            beats = 1;
            var denom = sch[1] + addBeats;

            for (let i = 0; i < notes.length; i++){
                notes[i][1] *= denom;
            }
        }
        return [notes, beats, arr];
    }

    generate(start){
        var lastGen = -1
        for (let i=start; i < this.notes.length; i++){
            if (this.notes[i][0]==="x"){
                this.genNotes(this.notes.slice(0,i));
                lastGen = i
            }
        }
    }

    genNotes(notes) {

        var fnotes = format(notes);
        const qns = mm.sequences.quantizeNoteSequence(fnotes, 1);
        var rnn_steps = notes.length + 1;
        var rnn_temperature = 1.1;

        music_rnn
            .continueSequence(qns, rnn_steps, rnn_temperature)
            .then((sample) => {
                var result = mm.sequences.unquantizeSequence(sample);
                this.notes[notes.length][0] = result.notes[0].pitch;
                this.generate(notes.length+1)
            })
    }
}

function format(n) {
    var steps = [];
    var st = 0.0;
    var end = 0.0;
    for (let i = 0; i < n.length; i++){
        end = st + 1/n[i][1];
        steps.push({pitch: n[i][0], startTime: st, endTime: end});
        st = end;
    }
    return {notes: steps, totalTime: end};
}
