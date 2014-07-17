//////////// AVERAGE VAL
exports.newAvrVal = function () {
    createAvr = function () {
        this.count = 0;
        this.avr = 0;

        this.update = function (val) {
            this.count++;
            this.avr = this.avr + (val - this.avr) / this.count;
            return this.prevAvr;
        }

        this.getAvr = function () {
            return this.avr;
        }
    }
    return new createAvr();
}

// About this module
exports.about = function () {
    var description = "Module with baseline predictions.";
    return description;
};