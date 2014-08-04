var analytics = require('analytics.js');

// Discretize Icon field
exports.discretizeIcon = function () {
    discretize = function (rec) {
        rec["clearDay"] = rec.icon === "clear-day" ? 1 : 0;
        rec["clearNight"] = rec.icon === "clear-night" ? 1 : 0;
        rec["rain"] = rec.icon === "rain" ? 1 : 0;
        rec["snow"] = rec.icon === "snow" ? 1 : 0;
        rec["sleet"] = rec.icon === "sleet" ? 1 : 0;
        rec["wind"] = rec.icon === "wind" ? 1 : 0;
        rec["fog"] = rec.icon === "fog" ? 1 : 0;
        rec["cloudy"] = rec.icon === "cloudy" ? 1 : 0;
        rec["partlyCloudyDay"] = rec.icon === "partly-cloudy-day" ? 1 : 0;
        rec["parltlyCloudyNight"] = rec.icon === "partly-cloudy-night" ? 1 : 0;
    }
    return discretize;
};

// Discretize Icon field in array
exports.discretizeIconToVec = function () {
    discretize = function (rec) {
        var iconValues = ["clear-day", "lear-night", "rain", "snow", "sleet", "wind",
                          "fog", "cloudy", "partly-cloudy-day", "partly-cloudy-night"];
        //var discretizedVec = la.newVec({ "vals": iconValues.length });
        //var discretizedVec = la.newIntVec({ "vals": iconValues.length });
        var discretizedVec = new Array(iconValues.length);
        iconValues.forEach(function (iconVal, index) {
            discretizedVec[index] = rec.icon === iconVal ? 1 : 0;
        });
        //console.startx(function (x) { return eval(x); })
        rec["iconDiscretized"] = discretizedVec;
        //console.startx(function (x) { return eval(x); })

        //This should also work, didnt test it
        //var iconFtrExt = analytics.newFeatureSpace([
        //    { type: "categorical", source: rec.$store.name, field: "icon", values: iconValues}
        //]);
        //rec["iconDiscretized"] = iconFtrExt.ftrVec(rec);
    }
    return discretize;
};


// About this module
exports.about = function () {
    var description = "This module contains functions for prreprocessing weather data.";
    return description;
};