// object for online metrics model
function createOnlineMetric(updateCallback) {
    this.error = -1;
    this.calcError = new updateCallback();
    // update function defined with callback function
    this.update = function (err) {
        this.error = this.calcError.update(err);
    }
    // getter for error
    this.getError = function () {
        return this.error;
    }
    return this;
}

exports.newMeanError = function () {
    function calcError() {
        this.sumErr = 0;
        this.count = 0;
        // update function
        this.update = function (err) {
            this.sumErr += err;
            this.count++;
            var error = this.sumErr / this.count;
            return error;
        }
    }
    return new createOnlineMetric(calcError);
}

exports.newMeanAbsoluteError = function () {
    function calcError () {
        this.sumErr = 0;
        this.count = 0;
        // update function
        this.update = function (err) {
            this.sumErr += Math.abs(err);
            this.count++;
            var error = this.sumErr / this.count;
            return error;
        }
    }
    return new createOnlineMetric(calcError);
}

exports.newMeanSquareError = function () {
    function calcError() {
        this.sumErr = 0;
        this.count = 0;
        // update function
        this.update = function (err) {
            this.sumErr += (err*err);
            this.count++;
            var error = this.sumErr / this.count;
            return error;
        }
    }
    return new createOnlineMetric(calcError);
}


exports.newRootMeanSquareError = function () {
    function calcError() {
        this.sumErr = 0;
        this.count = 0;
        // update function
        this.update = function (err) {
            this.sumErr += (err * err);
            this.count++;
            var error = this.sumErr / this.count;
            return Math.sqrt(error);
        }
    }
    return new createOnlineMetric(calcError);
}

// About this module
exports.about = function () {
    var description = "Module with evalutaion metrics.";
    return description;
};