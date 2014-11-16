// Dummy model, used for feature extractor
// .setVal() -- sets internal value
// .getVal() -- returns internal value
exports.newDummyModel = function () {
    var dummyModel = function () {
        var val = null;

        // Aditional function -- used for feature extractor --
        // Sets value, that can be called with .getVal() method
        this.setVal = function (val_in) {
            val = val_in;
        };

        // Aditional function -- used for feature extractor --
        // Returns values that was set with .setVal() method. 
        // .setVal() should always be called befor .getVal()
        this.getVal = function () {
            if (val == null) throw "You must first .setVal(val_in), before using .getVal()"
            var val_out = val;
            val = null

            return val_out;
        }
    }
    return new dummyModel();
}