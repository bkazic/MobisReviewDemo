exports.newHistoricalVals = function (numberOfVals) {
    var historicalValues = function (vals) {
        var size = vals;
        var vec = la.newVec({ "vals": size });
        this.update = function (newVal) {
            for (var ii = 0; ii < size - 1; ii++) {
                vec[ii] = vec[ii + 1]
            }
            vec[size - 1] = newVal;
        }
        this.getVals = function () {
            return vec;
        }
        this.getSize = function () {
            return size;
        }
    }
    return new historicalValues(numberOfVals)
}

//// circular buffer
//exports.newestHistoricalVals = function (numberOfVals) {
//    var historicalValues = function (vals) {
//        var size = vals;
//        var buff = la.newVec({ "vals": size });
//        var startIdx = 0;        
//        this.update = function (newVal) {
//            startIdx = (startIdx+1) % size;
//            buff[startIdx] = newVal;
//        }
//        this.getVals = function () {
//            var vec = la.newVec({ "vals": size })
//            var buffIdx = startIdx;
//            for (var ii = 0; ii < size; ii++) {
//                vec[ii] = buff[buffIdx];
//                buffIdx = (buffIdx + 1) % size;
//                //console.startx(function (x) { return eval(x); })
//            }            
//            return vec;
//        }
//        this.getSize = function () {
//            return size;
//        }
//    }
//    return new historicalValues(numberOfVals)
//}

// About this module
exports.about = function () {
    var description = "Module for historical values.";
    return description;
};